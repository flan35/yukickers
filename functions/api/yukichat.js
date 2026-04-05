export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check D1 Binding
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 database binding "DB" missing' }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  const now = Math.floor(Date.now() / 1000);

  try {
    if (method === 'POST') {
      const data = await request.json();
      const { id, name, avatar, x, y, msg } = data;

      if (!id) return new Response('Missing ID', { status: 400 });

      // 1. Reusable Moderation Function (Regex & AI)
      const moderateText = async (text, isName = false) => {
        if (!text) return isName ? '名無し' : '';
        
        const ngWords = [
          /[死殺][し抜き]?[に]?[行いくくるきた]|死[ねるんねなよ]|殺[すせさせすな]|ぶっ殺[すしたよ]|ぶち殺|ブチ殺|ブッ殺/g,
          /首[つ釣]る|自殺[しろたよ]|クタバレ|くたばれ|地獄|呪い/g,
          /殴[るりっ][てたぞぜ]|蹴[るりっ][てたぞぜ]|叩[くきい][てたぞぜ]|[刺指][さし]?[すした]|[埋う]め[るてた]/g,
          /ガイジ|池沼|片輪|基地外|きちがい|気違い|土人|土方|部落/g,
          /アホ|あほ|バカ|ばか|馬鹿|カス|かす|クズ|くず|ゴミ|ごみ|クソ|くそ|糞/g,
          /マンコ|まんこ|チンコ|ちんこ|フェラ|オナニー|中出し|なかがだし|セックス|淫乱|ヤリマン|レイプ|強姦|犯す/g,
          /[消き][ええ]?[るろてなのと]|いなくな[れっるな]/g
        ];
        const positiveWords = ['だいすき', 'らぶ', 'にこにこ', 'きらきら', 'はぴはぴ', '天才！', '最高に可愛い', 'しあわせ', 'ゆめかわいい', 'なかよし', '最高！', '世界一！', '尊い', 'みんななかよし！'];
        
        let moderated = text;
        ngWords.forEach(pattern => {
          moderated = moderated.replace(pattern, () => {
             return positiveWords[Math.floor(Math.random() * positiveWords.length)];
          });
        });

        // AI Moderation for longer strings to detect subtle abuse or PII
        if (moderated === text && text.length > 3 && env.AI) {
          try {
            const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
              messages: [
                { 
                  role: 'system', 
                  content: 'You are a chat moderator for a cute community site. Respond ONLY with "SAFE" or "TOXIC". Flag messages containing physical addresses, phone numbers, or severe insults as "TOXIC". Short or ambiguous messages are SAFE.' 
                },
                { role: 'user', content: `Input: "${text}"` }
              ],
              max_tokens: 5
            });
            const responseText = (aiResponse.response || aiResponse.result || '').toUpperCase();
            if (responseText.includes('TOXIC') && !responseText.includes('SAFE')) {
              moderated = positiveWords[Math.floor(Math.random() * positiveWords.length)];
            }
          } catch (e) {
            console.error('AI Moderation Failed:', e);
          }
        }
        return moderated;
      };

      // Moderate both Name and Message in parallel
      const [finalName, finalMsg] = await Promise.all([
        moderateText(name, true),
        moderateText(msg, false)
      ]);

      // 2. Update User Position using D1
      await env.DB.prepare(
        'INSERT OR REPLACE INTO yukichat_users (id, name, avatar, x, y, msg, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, finalName, avatar || 'chibi_yuki.png', x || 50, y || 50, finalMsg, now).run();

      // 3. Log Chat Message
      if (finalMsg) {
        await env.DB.prepare('INSERT INTO yukichat_logs (name, msg, ts) VALUES (?, ?, ?)').bind(finalName, finalMsg, now).run();
        // Keep only top 10 logs
        await env.DB.prepare('DELETE FROM yukichat_logs WHERE id NOT IN (SELECT id FROM yukichat_logs ORDER BY id DESC LIMIT 10)').run();
      }
      
      return new Response(JSON.stringify({ status: 'ok', msg: finalMsg }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (method === 'DELETE') {
      const { id } = await request.json();
      if (id) {
        await env.DB.prepare('DELETE FROM yukichat_users WHERE id = ?').bind(id).run();
      }
      return new Response(JSON.stringify({ status: 'ok' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (method === 'GET') {
      // Cleanup inactive users (older than 120s)
      await env.DB.prepare('DELETE FROM yukichat_users WHERE ts < ?').bind(now - 120).run();

      // Fetch active users, count, and logs in parallel
      const [usersData, activeCountData, logsData] = await Promise.all([
        env.DB.prepare('SELECT * FROM yukichat_users').all(),
        env.DB.prepare('SELECT COUNT(*) as count FROM yukichat_users WHERE ts > ?').bind(now - 120).first(),
        env.DB.prepare('SELECT * FROM yukichat_logs ORDER BY id DESC LIMIT 10').all()
      ]);

      const activeUsers = {};
      usersData.results.forEach(row => {
        activeUsers[row.id] = {
          name: row.name,
          avatar: row.avatar,
          x: row.x,
          y: row.y,
          msg: row.msg,
          ts: row.ts
        };
      });

      return new Response(JSON.stringify({
        users: activeUsers,
        activeCount: activeCountData.count || 0,
        logs: logsData.results || []
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (err) {
    console.error('Yukichat D1 API Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}
