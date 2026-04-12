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

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'DB binding missing' }), { status: 500, headers: corsHeaders });
  }

  const now = Math.floor(Date.now() / 1000);

  try {
    if (method === 'POST') {
      const data = await request.json();
      const { action } = data;

      // 1. Join Queue (Matching)
      if (action === 'join') {
        const { userId, name, avatar } = data;
        await env.DB.prepare('DELETE FROM zookeeper_queue WHERE joined_at < ?').bind(now - 30).run();
        const opponent = await env.DB.prepare('SELECT * FROM zookeeper_queue WHERE user_id != ? ORDER BY joined_at ASC LIMIT 1').bind(userId).first();

        if (opponent) {
          const matchId = 'm_' + Math.random().toString(36).substr(2, 9);
          const seed = Math.floor(Math.random() * 1000000);
          await env.DB.prepare(`
            INSERT INTO zookeeper_matches (match_id, p1_id, p1_name, p1_avatar, p2_id, p2_name, p2_avatar, seed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(matchId, opponent.user_id, opponent.name, opponent.avatar, userId, name, avatar, seed, now).run();
          await env.DB.prepare('DELETE FROM zookeeper_queue WHERE user_id IN (?, ?)').bind(opponent.user_id, userId).run();
          return new Response(JSON.stringify({ status: 'matched', matchId }), { headers: corsHeaders });
        } else {
          await env.DB.prepare('INSERT OR REPLACE INTO zookeeper_queue (user_id, name, avatar, joined_at) VALUES (?, ?, ?, ?)').bind(userId, name, avatar, now).run();
          return new Response(JSON.stringify({ status: 'waiting' }), { headers: corsHeaders });
        }
      }

      // 2. Refresh/Check Match (Survival)
      if (action === 'refresh') {
        const { userId } = data;
        // 生存確認として joined_at を更新
        await env.DB.prepare('UPDATE zookeeper_queue SET joined_at = ? WHERE user_id = ?').bind(now, userId).run();
        
        // 同時にマッチングが成立していないか確認
        const match = await env.DB.prepare('SELECT match_id FROM zookeeper_matches WHERE p1_id = ? OR p2_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId, userId).first();
        if (match) return new Response(JSON.stringify({ status: 'matched', matchId: match.match_id }), { headers: corsHeaders });
        return new Response(JSON.stringify({ status: 'waiting' }), { headers: corsHeaders });
      }

      // 3. Update Battle Stats
      if (action === 'update') {
        const { matchId, userId, atk, def, score } = data;
        const match = await env.DB.prepare('SELECT * FROM zookeeper_matches WHERE match_id = ?').bind(matchId).first();
        if (!match) return new Response('Not Found', { status: 404 });
        
        if (match.p1_id === userId) {
          await env.DB.prepare('UPDATE zookeeper_matches SET p1_atk = ?, p1_def = ?, p1_ready_ts = ? WHERE match_id = ?').bind(atk, def, now, matchId).run();
        } else {
          await env.DB.prepare('UPDATE zookeeper_matches SET p2_atk = ?, p2_def = ?, p2_ready_ts = ? WHERE match_id = ?').bind(atk, def, now, matchId).run();
        }
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      // 4. Sync Result (Winner)
      if (action === 'sync') {
        const { matchId, winnerId } = data;
        try {
          await env.DB.prepare('UPDATE zookeeper_matches SET winner_id = ? WHERE match_id = ?').bind(winnerId, matchId).run();
        } catch (e) { console.error("Sync Winner Error:", e); }
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      // 5. Record CPU Score
      if (action === 'record_cpu') {
        const { userId, name, avatar, score, maxCombo } = data;
        await env.DB.prepare('INSERT INTO yukipazu_scores_cpu (user_id, name, avatar, score, max_combo, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(userId, name, avatar, score, maxCombo, now).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }
    }

    if (method === 'GET') {
      const action = url.searchParams.get('action');
      const userId = url.searchParams.get('userId');
      const matchId = url.searchParams.get('matchId');

      if (action === 'ranking') {
        let pvpRanking = { results: [] };
        let cpuRanking = { results: [] };
        try {
          pvpRanking = await env.DB.prepare(`
            SELECT winner_id as id, p1_name as name, p1_avatar as avatar, COUNT(*) as wins 
            FROM zookeeper_matches 
            WHERE winner_id IS NOT NULL 
            GROUP BY winner_id 
            ORDER BY wins DESC LIMIT 10
          `).all();
        } catch (e) { console.error("PvP Ranking Error:", e); }
        try {
          cpuRanking = await env.DB.prepare('SELECT name, avatar, score FROM yukipazu_scores_cpu ORDER BY score DESC LIMIT 10').all();
        } catch (e) { console.error("CPU Ranking Error:", e); }
        return new Response(JSON.stringify({ pvp: pvpRanking.results || [], cpu: cpuRanking.results || [] }), { headers: corsHeaders });
      }
      
      if (userId) { // Old polling compatibility
         const match = await env.DB.prepare('SELECT match_id FROM zookeeper_matches WHERE p1_id = ? OR p2_id = ? ORDER BY created_at DESC LIMIT 1').bind(userId, userId).first();
         if (match) return new Response(JSON.stringify({ status: 'matched', matchId: match.match_id }), { headers: corsHeaders });
         return new Response(JSON.stringify({ status: 'waiting' }), { headers: corsHeaders });
      }

      if (matchId) {
        const match = await env.DB.prepare('SELECT * FROM zookeeper_matches WHERE match_id = ?').bind(matchId).first();
        return new Response(JSON.stringify(match), { headers: corsHeaders });
      }

      const countObj = await env.DB.prepare('SELECT COUNT(*) as count FROM zookeeper_queue WHERE joined_at > ?').bind(now - 30).first();
      return new Response(JSON.stringify({ queueCount: countObj ? countObj.count : 0 }), { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
