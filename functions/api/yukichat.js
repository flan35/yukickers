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

      // 1. Moderation (Regex & AI)
      const sanitizeRegex = (text) => {
        if (!text) return '';
        const ngWords = [
          /[死殺][し抜き]?[に]?[行いくくるきた]/g, /[死殺]す[ぞぜやろっ]/g, /[死殺][ねろ]/g, /ぶっ殺/g, /ぶち殺/g, /ブチ殺/g,
          /首[つ釣]る/g, /自殺[し]?[ろたよ]/g, /クタバレ/g, /くたばれ/g, /地獄/g, /呪い/g,
          /殴[るりっ][てたぞぜ]/g, /蹴[るりっ][てたぞぜ]/g, /叩[くきい][てたぞぜ]/g, /[刺指][さし]?[すした]/g, /[埋う]め[るてた]/g,
          /[壊こわ]す/g, /ぶっ[壊こわ]す/g, /爆破/g, /刺す/g,
          /ガイジ/g, /池沼/g, /片輪/g, /基地外/g, /きちがい/g, /気違い/g,
          /アホ/g, /あほ/g, /バカ/g, /ばか/g, /馬鹿/g, /カス/g, /かす/g, /クズ/g, /くず/g, /ゴミ/g, /ごみ/g, /クソ/g, /くそ/g, /糞/g,
          /マンコ/g, /まんこ/g, /チンコ/g, /ちんこ/g, /セックス/g, /レイプ/g, /強姦/g, /犯す/g,
          /消えろ/g, /きえろ/g, /いなくなれ/g
        ];
        const positiveWords = ['だいすき', 'らぶ', 'にこにこ', 'きらきら', 'はぴはぴ', '天才！', '最高に可愛い', 'しあわせ', 'ゆめかわいい', 'なかよし', '最高！', '世界一！', '尊い'];
        let sanitized = text;
        ngWords.forEach(pattern => {
          sanitized = sanitized.replace(pattern, () => {
             return positiveWords[Math.floor(Math.random() * positiveWords.length)];
          });
        });
        return sanitized;
      };

      let finalMsg = sanitizeRegex(msg);

      if (finalMsg === msg && msg.length > 0 && env.AI) {
        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
              { role: 'system', content: 'You are a chat moderator for a cute community site. Respond ONLY with "SAFE" or "TOXIC".' },
              { role: 'user', content: `Message: "${msg}"` }
            ],
            max_tokens: 5
          });
          if ((aiResponse.response || '').toUpperCase().includes('TOXIC')) {
            const positiveWords = ['だいすき', 'らぶ', 'にこにこ', 'きらきら', 'はぴはぴ', '天才！', '最高に可愛い', 'しあわせ', 'ゆめかわいい', '尊い'];
            finalMsg = positiveWords[Math.floor(Math.random() * positiveWords.length)];
          }
        } catch (e) {
          console.error('AI Moderation Failed:', e);
        }
      }

      // 2. Update User Position using D1
      await env.DB.prepare(
        'INSERT OR REPLACE INTO yukichat_users (id, name, avatar, x, y, msg, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, name || '名無し', avatar || 'chibi_yuki.png', x || 50, y || 50, finalMsg, now).run();

      // 3. Log Chat Message
      if (finalMsg) {
        await env.DB.prepare('INSERT INTO yukichat_logs (name, msg, ts) VALUES (?, ?, ?)').bind(name || '名無し', finalMsg, now).run();
        // Keep only top 10 logs
        await env.DB.prepare('DELETE FROM yukichat_logs WHERE id NOT IN (SELECT id FROM yukichat_logs ORDER BY id DESC LIMIT 10)').run();
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
