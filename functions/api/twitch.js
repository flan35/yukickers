export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const usernamesParam = url.searchParams.get('usernames');

  if (!usernamesParam) {
    return new Response(JSON.stringify({ error: 'Missing usernames parameter' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const clientId = env.TWITCH_CLIENT_ID;
  const clientSecret = env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Twitch credentials not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    // 1. Get Access Token (Cache in KV if available, otherwise fetch)
    let accessToken = null;
    if (env.KV) {
      accessToken = await env.KV.get('twitch_access_token');
    }

    if (!accessToken) {
      const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials'
        })
      });
      
      if (!tokenRes.ok) {
        throw new Error('Failed to fetch Twitch access token');
      }
      
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      
      if (env.KV && accessToken) {
        // Cache token for a bit less than its expiration (usually 60 days)
        await env.KV.put('twitch_access_token', accessToken, { expirationTtl: Math.min(tokenData.expires_in - 60, 2592000) });
      }
    }

    // 2. Fetch Stream Info from Helix API
    const usernames = usernamesParam.split(',').map(u => u.trim());
    const query = usernames.map(u => `user_login=${encodeURIComponent(u)}`).join('&');
    
    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!streamRes.ok) {
      // If token expired, clear cache and try again once would be ideal, but for now just error
      if (streamRes.status === 401 && env.KV) {
        await env.KV.delete('twitch_access_token');
      }
      throw new Error(`Twitch API error: ${streamRes.status}`);
    }

    const streamData = await streamRes.json();
    
    // 3. Format response mapping
    const results = {};
    usernames.forEach(u => {
      results[u.toLowerCase()] = { is_live: false };
    });
    
    if (streamData.data) {
      streamData.data.forEach(stream => {
        results[stream.user_login.toLowerCase()] = {
          is_live: true,
          title: stream.title,
          viewer_count: stream.viewer_count,
          game_name: stream.game_name,
          thumbnail: stream.thumbnail_url.replace('{width}', '400').replace('{height}', '225'),
          user_name: stream.user_name
        };
      });
    }

    return new Response(JSON.stringify(results), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60' 
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
