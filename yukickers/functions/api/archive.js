const MEMBERS = [
  'yuki_0121', 'nodazourip', 'inosisi0909', 
  '04miki05', 'kariko2525', 'ponchan_2525'
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const action = url.searchParams.get('action');
  const username = url.searchParams.get('username');
  const reset = url.searchParams.get('reset');
  const now = new Date().toISOString();

  // Helper for Upstash REST API requests
  const redisQuery = async (cmdArray) => {
    const res = await fetch(env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cmdArray)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  };

  if (reset === '1') {
    await redisQuery(["DEL", 'history:list']);
    await redisQuery(["DEL", 'history:finalized_ids']);
  }

  try {
    // Action: Cron check (Server-side automatic check)
    if (action === 'cron') {
      const results = [];
      for (const user of MEMBERS) {
        try {
          const kickRes = await fetch(`https://kick.com/api/v2/channels/${user}`);
          if (!kickRes.ok) continue;

          const data = await kickRes.json();
          const livestream = data.livestream;
          const sessionKey = `history:session:${user}`;

          const lastSessionRaw = await redisQuery(["GET", sessionKey]);
          const lastSession = lastSessionRaw ? JSON.parse(lastSessionRaw) : null;

          if (livestream) {
            const streamId = String(livestream.id || livestream.created_at);
            if (!lastSession || lastSession.id !== streamId) {
              const newSession = {
                id: streamId,
                username: user,
                start: livestream.start_time || livestream.created_at || now,
                title: livestream.session_title || 'No Title',
                lastSeen: now
              };
              await redisQuery(["SET", sessionKey, JSON.stringify(newSession)]);
            } else {
              lastSession.lastSeen = now;
              await redisQuery(["SET", sessionKey, JSON.stringify(lastSession)]);
            }
          } else {
            if (lastSession) {
              const deleted = await redisQuery(["DEL", sessionKey]);
              if (deleted) {
                await finalizeSession(lastSession, lastSession.lastSeen || now, redisQuery);
              }
            }
          }
          results.push({ user, status: livestream ? 'live' : 'offline' });
        } catch (e) {
          console.error(`Cron check failed for ${user}:`, e);
        }
      }
      return new Response(JSON.stringify({ status: 'ok', results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Action: Sync VODs
    if (action === 'sync' && request.method === 'POST') {
      const { videos } = await request.json();
      if (!username || !videos || !Array.isArray(videos)) {
        return new Response(JSON.stringify({ error: 'Username and videos array required' }), { status: 400, headers: corsHeaders });
      }

      let syncedCount = 0;
      for (const video of videos) {
        const alreadyFinalized = await redisQuery(["SISMEMBER", 'history:finalized_ids', String(video.id)]);
        if (alreadyFinalized) continue;

        const start = new Date(video.created_at);
        const durationMs = video.duration || 0;
        const end = new Date(start.getTime() + durationMs);

        if (durationMs < 60000) continue;

        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const durationStr = `${hours}時間${minutes}分`;

        const record = {
          id: String(video.id),
          date: start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '.'),
          username: username,
          startTime: start.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
          endTime: end.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
          title: video.session_title || 'No Title',
          duration: durationStr,
          link: `https://kick.com/${username}/videos/${video.uuid || video.id}`
        };

        await redisQuery(["SADD", 'history:finalized_ids', String(video.id)]);
        await redisQuery(["LPUSH", 'history:list', JSON.stringify(record)]);
        syncedCount++;
      }

      if (syncedCount > 0) {
        await redisQuery(["LTRIM", 'history:list', 0, 99]);
      }

      return new Response(JSON.stringify({ status: 'ok', synced: syncedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Action: Get history list
    if (action === 'list') {
      const historyRaw = await redisQuery(["LRANGE", 'history:list', 0, 99]);
      if (!historyRaw || historyRaw.length === 0) return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

      // Map raw string JSON to JS objects
      const history = historyRaw.map(v => typeof v === 'string' ? JSON.parse(v) : v);

      const sorted = history.sort((a, b) => {
        const dateA = a.date.split('.').map(n => n.padStart(2, '0')).join('');
        const dateB = b.date.split('.').map(n => n.padStart(2, '0')).join('');
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return b.startTime.localeCompare(a.startTime);
      });

      return new Response(JSON.stringify(sorted.slice(0, 30)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('Archive API error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}

async function finalizeSession(session, endTime, redisQuery) {
  if (!session.id) return;

  const alreadyFinalized = await redisQuery(["SISMEMBER", 'history:finalized_ids', String(session.id)]);
  if (alreadyFinalized) return;

  const start = new Date(session.start);
  const end = new Date(endTime || new Date());
  const durationMs = end - start;
  
  if (durationMs < 60000) return;

  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const durationStr = `${hours}時間${minutes}分`;

  const record = {
    id: session.id,
    date: start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '.'),
    username: session.username,
    startTime: start.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
    endTime: end.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
    title: session.title,
    duration: durationStr,
    link: `https://kick.com/${session.username}/videos`
  };

  await redisQuery(["SADD", 'history:finalized_ids', String(session.id)]);
  await redisQuery(["LPUSH", 'history:list', JSON.stringify(record)]);
  await redisQuery(["LTRIM", 'history:list', 0, 99]); 
}
