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
  const now = new Date().toISOString();

  // Cloudflare KV binding check
  if (!env.KV) {
    return new Response(JSON.stringify({ 
      error: 'KV namespace not bound. Please check Cloudflare Pages settings.' 
    }), { status: 500, headers: corsHeaders });
  }

  try {
    // Action: Cron check (Checks live status and records history)
    if (action === 'cron') {
      const results = [];
      for (const user of MEMBERS) {
        try {
          const kickRes = await fetch(`https://kick.com/api/v2/channels/${user}`);
          if (!kickRes.ok) continue;

          const data = await kickRes.json();
          const livestream = data.livestream;
          const sessionKey = `session:${user}`;

          const lastSessionRaw = await env.KV.get(sessionKey);
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
              await env.KV.put(sessionKey, JSON.stringify(newSession));
            } else {
              lastSession.lastSeen = now;
              await env.KV.put(sessionKey, JSON.stringify(lastSession));
            }
          } else {
            if (lastSession) {
              await env.KV.delete(sessionKey);
              await finalizeSession(lastSession, lastSession.lastSeen || now, env.KV);
            }
          }
          results.push({ user, status: livestream ? 'live' : 'offline' });
        } catch (e) {
          console.error(`Cron check failed for ${user}:`, e);
        }
      }
      return new Response(JSON.stringify({ status: 'ok', results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Action: Get history list
    if (action === 'list') {
      const historyRaw = await env.KV.get('history_list');
      if (!historyRaw) return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

      const history = JSON.parse(historyRaw);

      // Sort by date descending, then start time descending
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

async function finalizeSession(session, endTime, KV) {
  if (!session.id) return;

  const idKey = `finalized_id:${session.id}`;
  const alreadyFinalized = await KV.get(idKey);
  if (alreadyFinalized) return;

  const start = new Date(session.start);
  const end = new Date(endTime);
  const durationMs = end - start;
  
  if (durationMs < 60000) return; // Ignore streams less than 1 min

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

  const historyRaw = await KV.get('history_list');
  let history = historyRaw ? JSON.parse(historyRaw) : [];
  
  // Unshift (add to front) and limit to 100 items
  history.unshift(record);
  if (history.length > 100) {
    history = history.slice(0, 100);
  }
  
  await KV.put('history_list', JSON.stringify(history));
  await KV.put(idKey, "1");
}
