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
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  // Check for bans (Blacklist/Permanent) - skip check for OPTIONS
  if (method !== 'OPTIONS') {
    const userId = url.searchParams.get('id') || '';
    const isBanned = await env.DB.prepare('SELECT id FROM yukichat_blacklist WHERE id = ? OR ip = ?').bind(userId, ip).first();
    if (isBanned) {
      return new Response(JSON.stringify({ error: '永久追放されています。', reason: 'banned' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check for kicks (Temporary - 5 mins)
    const isKicked = await env.DB.prepare('SELECT id FROM yukichat_kicked WHERE (id = ? OR ip = ?) AND ts > ?').bind(userId, ip, now - 300).first();
    if (isKicked) {
      return new Response(JSON.stringify({ error: 'キックされました。5分後には入れます。', reason: 'kicked' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  try {
    if (method === 'POST') {
      const data = await request.json();
      const { id, name, avatar, x, y, msg, password, action, targetId, is_waiting } = data;
      const isAdmin = password === '1234' ? 1 : 0;
      const isWaiting = is_waiting === 0 ? 0 : 1; // Default to 1 (waiting) unless explicitly 0

      if (action === 'kick' && password === '1234' && targetId) {
        // Get target's IP from current users before deleting
        const target = await env.DB.prepare('SELECT ip FROM yukichat_users WHERE id = ?').bind(targetId).first();
        const targetIp = target ? target.ip : 'unknown';
        
        await env.DB.prepare('INSERT OR REPLACE INTO yukichat_kicked (id, ip, ts) VALUES (?, ?, ?)').bind(targetId, targetIp, now).run();
        await env.DB.prepare('DELETE FROM yukichat_users WHERE id = ?').bind(targetId).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      if (action === 'ban' && password === '1234' && targetId) {
        // Get target's IP from current users before deleting
        const target = await env.DB.prepare('SELECT ip FROM yukichat_users WHERE id = ?').bind(targetId).first();
        const targetIp = target ? target.ip : 'unknown';
        
        await env.DB.prepare('INSERT OR REPLACE INTO yukichat_blacklist (id, ip, ts) VALUES (?, ?, ?)').bind(targetId, targetIp, now).run();
        await env.DB.prepare('DELETE FROM yukichat_users WHERE id = ?').bind(targetId).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      if (action === 'deleteLog' && password === '1234' && targetId) {
        await env.DB.prepare('DELETE FROM yukichat_logs WHERE id = ?').bind(targetId).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      if (action === 'clearLogs' && password === '1234') {
        await env.DB.prepare('DELETE FROM yukichat_logs').run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      if (!id) return new Response('Missing ID', { status: 400 });

      // 1. Reusable Moderation Function (Regex & AI)
      const moderateText = async (text, isName = false) => {
        if (!text) return { text: isName ? '名無し' : '', isNG: false };
        
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
        let isNG = false;
        ngWords.forEach(pattern => {
          if (pattern.test(text)) {
            isNG = true;
            moderated = moderated.replace(pattern, () => {
               return positiveWords[Math.floor(Math.random() * positiveWords.length)];
            });
          }
        });

        // AI Moderation for longer strings to detect subtle abuse or PII
        if (!isNG && text.length > 3 && env.AI) {
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
              isNG = true;
              moderated = positiveWords[Math.floor(Math.random() * positiveWords.length)];
            }
          } catch (e) {
            console.error('AI Moderation Failed:', e);
          }
        }
        return { text: moderated, isNG };
      };

      // Check room and name for first-time entry (msg is blank or first post)
      // We check if the ID already exists in the active list
      const existingUser = await env.DB.prepare('SELECT id FROM yukichat_users WHERE id = ? AND ts > ?').bind(id, now - 120).first();
      
      const modName = await moderateText(name, true);
      if (modName.isNG) {
        return new Response(JSON.stringify({ status: 'error', reason: 'name_ng' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (!existingUser && isAdmin !== 1) {
        const activeCountData = await env.DB.prepare('SELECT COUNT(*) as count FROM yukichat_users WHERE ts > ?').bind(now - 120).first();
        if ((activeCountData.count || 0) >= 10) {
          return new Response(JSON.stringify({ status: 'error', reason: 'room_full' }), { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      const modMsg = await moderateText(msg, false);

      // 2. Update User Position using D1
      await env.DB.prepare(
        'INSERT OR REPLACE INTO yukichat_users (id, name, avatar, x, y, msg, ts, is_admin, ip, is_waiting) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, modName.text, avatar || 'chibi_yuki.png', x || 50, y || 50, modMsg.text, now, isAdmin, ip, isWaiting).run();

      // 3. Log Chat Message
      if (modMsg.text) {
        await env.DB.prepare('INSERT INTO yukichat_logs (name, msg, ts, is_admin) VALUES (?, ?, ?, ?)').bind(modName.text, modMsg.text, now, isAdmin).run();
        // Keep only top 20 logs
        await env.DB.prepare('DELETE FROM yukichat_logs WHERE id NOT IN (SELECT id FROM yukichat_logs ORDER BY id DESC LIMIT 20)').run();
      }
      
      return new Response(JSON.stringify({ status: 'ok', msg: modMsg.text }), { 
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
      // Cleanup inactive users (older than 120s, but keep admins)
      await env.DB.prepare('DELETE FROM yukichat_users WHERE ts < ? AND is_admin = 0').bind(now - 120).run();

      // Fetch active users, counts, and logs in parallel
      const [usersData, activeCountData, waitingCountData, logsData] = await Promise.all([
        env.DB.prepare('SELECT * FROM yukichat_users WHERE is_waiting = 0').all(),
        env.DB.prepare('SELECT COUNT(*) as count FROM yukichat_users WHERE ts > ? AND is_waiting = 0').bind(now - 120).first(),
        env.DB.prepare('SELECT COUNT(*) as count FROM yukichat_users WHERE ts > ? AND is_waiting = 1').bind(now - 120).first(),
        env.DB.prepare('SELECT * FROM yukichat_logs ORDER BY id DESC LIMIT 20').all()
      ]);

      const activeUsers = {};
      usersData.results.forEach(row => {
        activeUsers[row.id] = {
          name: row.name,
          avatar: row.avatar,
          x: row.x,
          y: row.y,
          msg: row.msg,
          ts: row.ts,
          is_admin: row.is_admin
        };
      });

      return new Response(JSON.stringify({
        users: activeUsers,
        activeCount: activeCountData.count || 0,
        waitingCount: waitingCountData.count || 0,
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
