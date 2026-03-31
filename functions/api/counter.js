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

  const COUNTER_KEY = 'visitor_count';

  try {
    if (action === 'increment') {
      // Get current count
      const currentRaw = await env.KV.get(COUNTER_KEY);
      let current = currentRaw ? parseInt(currentRaw) : 0;
      
      // Increment
      const next = current + 1;
      await env.KV.put(COUNTER_KEY, String(next));
      
      return new Response(JSON.stringify({ count: next }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Default or 'get' action
    const currentRaw = await env.KV.get(COUNTER_KEY);
    const current = currentRaw ? parseInt(currentRaw) : 0;
    
    return new Response(JSON.stringify({ count: current }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
