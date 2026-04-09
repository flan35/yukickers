const MEMBERS = [
  'yuki_0121', 'nodazourip', 'inosisi0909', 
  '04miki05', 'kariko2525', 'ponchan_2525',
  'michaaam', 'toromi2525', 'uritafuufu'
];

export async function onRequest(context) {
  const { request, env, waitUntil } = context; // context.waitUntil is used to run tasks in the background
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
    if (action === 'cron' || action === 'force_cron') {
      const results = await runCronTask(MEMBERS, env, now);
      return new Response(JSON.stringify({ status: 'ok', results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Action: Sync/Bootstrap past stream history
    if (action === 'sync' || action === 'bootstrap') {
      const allNewRecords = [];
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://kick.com/'
      };

      for (const user of MEMBERS) {
        try {
          const vRes = await fetch(`https://kick.com/api/v2/channels/${user}/videos`, { headers });
          if (!vRes.ok) {
            console.warn(`Kick Video API returned ${vRes.status} for ${user}`);
            continue;
          }
          const vData = await vRes.json();
          if (Array.isArray(vData)) {
            vData.forEach(v => {
              const start = new Date(v.created_at);
              const durationMs = v.duration || 0;
              const end = new Date(start.getTime() + durationMs);
              const hours = Math.floor(durationMs / 3600000);
              const minutes = Math.floor((durationMs % 3600000) / 60000);
              const durationStr = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;

              allNewRecords.push({
                id: String(v.id),
                date: start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '.'),
                username: user,
                startTime: start.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
                endTime: end.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
                title: v.session_title || 'No Title',
                duration: durationStr,
                link: `https://kick.com/${user}/videos`
              });
            });
          }
        } catch (e) {
          console.error(`Sync failed for ${user}:`, e);
        }
      }

      // Merge with existing
      const historyRaw = await env.KV.get('history_list');
      let combined = historyRaw ? JSON.parse(historyRaw) : [];
      combined = [...allNewRecords, ...combined];

      // De-duplicate by ID
      const uniqueMap = new Map();
      combined.forEach(item => {
        if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
      });

      // Sort by date/time descending
      const finalHistory = Array.from(uniqueMap.values()).sort((a, b) => {
        const dateA = a.date.split('.').map(n => n.padStart(2, '0')).join('');
        const dateB = b.date.split('.').map(n => n.padStart(2, '0')).join('');
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return b.startTime.localeCompare(a.startTime);
      });

      // Limit to 30 items
      const truncated = finalHistory.slice(0, 30);
      await env.KV.put('history_list', JSON.stringify(truncated));

      return new Response(JSON.stringify({ status: 'synced', count: truncated.length, data: truncated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Action: Get history list
    if (action === 'list') {
      // --- LAZY CRON LOGIC ---
      // Trigger background update if more than 10 minutes (600s) since last run
      const CRON_TS_KEY = 'last_archive_cron_run';
      const lastRun = await env.KV.get(CRON_TS_KEY);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (!lastRun || (currentTime - parseInt(lastRun)) > 600) {
        // Update timestamp immediately to avoid parallel triggers
        await env.KV.put(CRON_TS_KEY, String(currentTime));
        // Use waitUntil to run the cron task in the background
        if (typeof waitUntil === 'function') {
          waitUntil(runCronTask(MEMBERS, env, now));
        } else {
          // Fallback for environments where waitUntil is not available
          runCronTask(MEMBERS, env, now).catch(err => console.error('Archive background cron failed', err));
        }
      }
      // -----------------------

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

/**
 * Shared logic for checking Kick status and updating sessions/history
 */
async function runCronTask(membersList, env, now) {
  const results = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://kick.com/'
  };

  for (const user of membersList) {
    try {
      const kickRes = await fetch(`https://kick.com/api/v2/channels/${user}`, { headers });
      if (!kickRes.ok) {
        console.warn(`Kick API returned ${kickRes.status} for ${user}`);
        continue;
      }

      const data = await kickRes.json();
      const livestream = data.livestream;
      const sessionKey = `session:${user}`;

      const lastSessionRaw = await env.KV.get(sessionKey);
      const lastSession = lastSessionRaw ? JSON.parse(lastSessionRaw) : null;

      if (livestream) {
        const streamId = String(livestream.id || livestream.created_at);
        const streamTitle = livestream.session_title || 'No Title';
        // Only write if it's a NEW session or the title changed
        if (!lastSession || lastSession.id !== streamId || lastSession.title !== streamTitle) {
          const newSession = {
            id: streamId,
            username: user,
            start: livestream.start_time || livestream.created_at || now,
            title: streamTitle,
            lastSeen: now // This record will only be updated in KV when start/title change
          };
          await env.KV.put(sessionKey, JSON.stringify(newSession));
        }
      } else {
        if (lastSession) {
          await env.KV.delete(sessionKey);
          // Use 'now' (server detection time) as the end of stream
          // finalizeSession will then check the actual VOD duration for final accuracy
          await finalizeSession(lastSession, now, env.KV);
        }
      }
      results.push({ user, status: livestream ? 'live' : 'offline' });
    } catch (e) {
      console.error(`Cron check failed for ${user}:`, e);
    }
  }
  return results;
}

async function finalizeSession(session, endTime, KV) {
  if (!session.id) return;

  const idKey = `finalized_id:${session.id}`;
  const alreadyFinalized = await KV.get(idKey);
  if (alreadyFinalized) return;

  let start = new Date(session.start);
  let end = new Date(endTime);
  let durationMs = end - start;
  let title = session.title;

  // --- HIGH PRECISION VOD CORRECTION ---
  try {
    // Fetch the latest videos for the user to find the exact duration
    const vRes = await fetch(`https://kick.com/api/v2/channels/${session.username}/videos`);
    if (vRes.ok) {
      const vData = await vRes.json();
      if (Array.isArray(vData)) {
        // Find a video that started around the same time as our recorded session
        // (within 30 minutes margin to be safe)
        const match = vData.find(v => {
          const vStart = new Date(v.created_at);
          const diff = Math.abs(vStart - start);
          return diff < 1800000; // 30 minutes
        });

        if (match && match.duration > 0) {
          durationMs = match.duration; // match.duration is in ms
          end = new Date(start.getTime() + durationMs);
          if (match.session_title) title = match.session_title;
          console.log(`Matched VOD for ${session.username}: ${match.id}, corrected duration: ${durationMs}ms`);
        }
      }
    }
  } catch (e) {
    console.error('VOD correction failed:', e);
    // Continue with the estimated duration if VOD check fails
  }
  // -------------------------------------
  
  if (durationMs < 60000) return; // Ignore streams less than 1 min

  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const durationStr = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;

  const record = {
    id: session.id,
    date: start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/\//g, '.'),
    username: session.username,
    startTime: start.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
    endTime: end.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }),
    title: title,
    duration: durationStr,
    link: `https://kick.com/${session.username}/videos`
  };

  const historyRaw = await KV.get('history_list');
  let history = historyRaw ? JSON.parse(historyRaw) : [];
  
  // Check if this record already exists in history (safety)
  if (history.some(h => h.id === record.id)) return;

  // Unshift (add to front) and limit to 100 items
  history.unshift(record);
  if (history.length > 100) {
    history = history.slice(0, 100);
  }
  
  await KV.put('history_list', JSON.stringify(history));
  await KV.put(idKey, "1");
}
