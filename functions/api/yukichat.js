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
    const queryPw = url.searchParams.get('pw') || '';
    
    // Admin Exemption: Check DB record OR password in query
    let isActuallyAdmin = queryPw === '1234';
    if (!isActuallyAdmin && userId) {
      const adminCheck = await env.DB.prepare('SELECT is_admin FROM yukichat_users WHERE id = ?').bind(userId).first();
      isActuallyAdmin = adminCheck && adminCheck.is_admin === 1;
    }

    if (!isActuallyAdmin && (userId || (ip && ip !== 'unknown'))) {
      // Blacklist
      const isBanned = await env.DB.prepare('SELECT id FROM yukichat_blacklist WHERE (id != "" AND id = ?) OR (ip != "unknown" AND ip = ?)').bind(userId, ip).first();
      if (isBanned) {
        return new Response(JSON.stringify({ error: '永久追放されています。', reason: 'banned' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Kicks (Temporary - 1 min)
      const isKicked = await env.DB.prepare('SELECT id FROM yukichat_kicked WHERE ((id != "" AND id = ?) OR (ip != "unknown" AND ip = ?)) AND ts > ?').bind(userId, ip, now - 60).first();
      if (isKicked) {
        return new Response(JSON.stringify({ error: 'キックされました。1分後には入れます。', reason: 'kicked' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }
  }

  // Ensure settings table exists
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS yukichat_settings (key TEXT PRIMARY KEY, value TEXT)').run();

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

      if (action === 'music' && (id || isAdmin)) {
        const musicState = data.value === 'on' ? '1' : '0';
        await env.DB.prepare('INSERT OR REPLACE INTO yukichat_settings (key, value) VALUES ("music_on", ?)').bind(musicState).run();
        if (musicState === '1') {
          await env.DB.prepare('INSERT OR REPLACE INTO yukichat_settings (key, value) VALUES ("music_start_time", ?)').bind(Date.now().toString()).run();
        }
        return new Response(JSON.stringify({ status: 'ok', music_on: musicState === '1' }), { headers: corsHeaders });
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
          /[消き][ええ]?[るろてなのと]|いなくな[れっるな]/g,
          /老害|ろうがい|ジジイ|じじい|ジジィ|ババア|ばばあ|ババァ|BBA|bba/gi,
          /ハゲ|はげ|禿げ|禿|デブ|でぶ|ブス|ぶす|ブサイク|ぶさいく|不細工/g,
          /キモ[いっ]|きも[いっ]|気持ち悪[いっ]|きしょ[いっ]|キショ[いっ]|うざ[いっ]|ウザ[いっ]|邪魔|じゃま/g,
          /障[害碍がい]者?|知[遅恥]|低脳|低能|無能|ニート|引きこもり|陰キャ|チー牛/g,
          /しね|シネ|タヒ[ねな]|たひ[ねな]|氏ね|市ね/g
        ];
        const positiveWords = ['だいすき', 'らぶ', 'にこにこ', 'きらきら', 'はぴはぴ', '天才！', '最高に可愛い', 'しあわせ', 'ゆめかわいい', 'なかよし', '最高！', '世界一！', '尊い', 'みんななかよし！'];
        
        // Strip all HTML tags to prevent images and large text
        let moderated = text.replace(/<[^>]*>?/gm, '');

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
                  content: `You are a Japanese chat moderator for a cute, friendly community. Respond ONLY with "SAFE" or "TOXIC".

Flag as TOXIC ONLY if the message is used to ATTACK, HARASS, or PROMOTE harm.
- Malicious insults (appearance, age, disability, etc.)
- Threats, promoting violence, or telling someone to die.
- Sexual harassment or graphic content.
- Hate speech or discriminatory slurs.
- Doxing (posting phone numbers, addresses).

SAFE EXCEPTIONS (ALLOW THESE):
- Rejecting or advising against bad behavior (e.g., "暴力やめて", "いじめるな", "stop violence").
- Self-expression or general questions that aren't attacking anyone.
- Typical chat greetings and friendly talk.

If the user is trying to maintain peace or express a negative opinion about bad things, it is SAFE.`
                },
                { role: 'user', content: `Is this message safe for a cute community chat? Input: "${text}"` }
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
        if ((activeCountData.count || 0) >= 20) {
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

      // 3. Log Chat Message (Skip if it's an emote)
      if (modMsg.text && !data.is_emote) {
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
      const url = new URL(request.url);
      const isInitial = url.searchParams.get('is_initial') === '1';

      // Cleanup inactive users (older than 120s, but keep admins)
      await env.DB.prepare('DELETE FROM yukichat_users WHERE ts < ? AND is_admin = 0').bind(now - 120).run();

      // Fetch active users, counts, logs, and settings in parallel
      const [usersData, activeCountData, waitingCountData, logsData, musicSetting, musicStartSetting] = await Promise.all([
        env.DB.prepare('SELECT * FROM yukichat_users WHERE is_waiting = 0').all(),
        env.DB.prepare('SELECT COUNT(*) as count FROM yukichat_users WHERE ts > ? AND is_waiting = 0').bind(now - 120).first(),
        env.DB.prepare('SELECT COUNT(*) as count FROM yukichat_users WHERE ts > ? AND is_waiting = 1').bind(now - 120).first(),
        env.DB.prepare('SELECT * FROM yukichat_logs ORDER BY id DESC LIMIT 20').all(),
        env.DB.prepare('SELECT value FROM yukichat_settings WHERE key = "music_on"').first(),
        env.DB.prepare('SELECT value FROM yukichat_settings WHERE key = "music_start_time"').first()
      ]);

      let musicOn = musicSetting ? musicSetting.value === '1' : false;
      
      // Check if the requester is active
      const id = url.searchParams.get('id');
      const requester = id ? await env.DB.prepare('SELECT is_waiting FROM yukichat_users WHERE id = ?').bind(id).first() : null;
      const isRequesterActive = requester && requester.is_waiting === 0;

      // Reset music ONLY if room is truly empty, OR if the first ACTIVE person joins an "abandoned" ON state
      if (activeCountData.count === 0 || (isInitial && isRequesterActive && activeCountData.count === 1)) {
        if (musicOn) {
          await env.DB.prepare('UPDATE yukichat_settings SET value = "0" WHERE key = "music_on"').run();
          musicOn = false;
        }
      }

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
        logs: logsData.results || [],
        music_on: musicOn,
        music_start_time: musicStartSetting ? parseInt(musicStartSetting.value) : 0,
        server_time: Date.now()
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
