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

  if (!env.KV) {
    return new Response(JSON.stringify({ error: 'KV binding missing' }), { status: 500, headers: corsHeaders });
  }

  // Get JST (Tokyo) date
  const now = new Date();
  const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayStr = jstNow.toISOString().split('T')[0]; // YYYY-MM-DD
  const yesterdayDate = new Date(jstNow.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const TOTAL_KEY = 'visitor_total';
  const TODAY_KEY = `visitor_day:${todayStr}`;
  const YESTERDAY_KEY = `visitor_day:${yesterdayStr}`;

  try {
    // 1. Get current values
    const [totalRaw, todayRaw, yesterdayRaw] = await Promise.all([
      env.KV.get(TOTAL_KEY),
      env.KV.get(TODAY_KEY),
      env.KV.get(YESTERDAY_KEY)
    ]);

    let totalCount = totalRaw ? parseInt(totalRaw) : 0;
    let todayCount = todayRaw ? parseInt(todayRaw) : 0;
    let yesterdayCount = yesterdayRaw ? parseInt(yesterdayRaw) : 0;

    if (action === 'increment') {
      totalCount++;
      todayCount++;
      
      // 2. Save incremented values
      await Promise.all([
        env.KV.put(TOTAL_KEY, String(totalCount)),
        env.KV.put(TODAY_KEY, String(todayCount))
      ]);
    }

    return new Response(JSON.stringify({
      total: totalCount,
      today: todayCount,
      yesterday: yesterdayCount
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
