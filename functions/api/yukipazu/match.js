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
      const { action, userId, name, avatar, matchId, atk, def, special, phase, winnerId } = data;

      // 1. Join Queue
      if (action === 'join') {
        if (!userId) return new Response('Missing userId', { status: 400 });

        // Clean up old queue entries (> 30s)
        await env.DB.prepare('DELETE FROM zookeeper_queue WHERE joined_at < ?').bind(now - 30).run();

        // Check if already in queue
        await env.DB.prepare('INSERT OR REPLACE INTO zookeeper_queue (user_id, name, avatar, joined_at) VALUES (?, ?, ?, ?)').bind(userId, name, avatar, now).run();

        // Try to find an opponent (not including self)
        const opponent = await env.DB.prepare('SELECT * FROM zookeeper_queue WHERE user_id != ? ORDER BY joined_at ASC LIMIT 1').bind(userId).first();

        if (opponent) {
          const newMatchId = `match_${now}_${userId}_${opponent.user_id}`;
          
          // Create Match
          await env.DB.prepare(`
            INSERT INTO zookeeper_matches (
              match_id, p1_id, p1_name, p1_avatar, p2_id, p2_name, p2_avatar, 
              phase, start_ts, last_update_ts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'puzzle', ?, ?)
          `).bind(newMatchId, userId, name, avatar, opponent.user_id, opponent.name, opponent.avatar, now, now).run();

          // Remove both from queue
          await env.DB.prepare('DELETE FROM zookeeper_queue WHERE user_id IN (?, ?)').bind(userId, opponent.user_id).run();

          return new Response(JSON.stringify({ status: 'matched', matchId: newMatchId }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ status: 'waiting' }), { headers: corsHeaders });
      }

      // 2. Update Match State (Score/HP/Phase)
      if (action === 'update') {
        if (!matchId || !userId) return new Response('Missing ID', { status: 400 });

        const match = await env.DB.prepare('SELECT * FROM zookeeper_matches WHERE match_id = ?').bind(matchId).first();
        if (!match) return new Response('Match not found', { status: 404 });

        const isP1 = match.p1_id === userId;
        const prefix = isP1 ? 'p1' : 'p2';

        // Update ATK/DEF/SPECIAL for current round
        await env.DB.prepare(`
          UPDATE zookeeper_matches 
          SET ${prefix}_atk = ?, ${prefix}_def = ?, ${prefix}_special = ?, last_update_ts = ?
          WHERE match_id = ?
        `).bind(atk || 0, def || 0, special || 0, now, matchId).run();

        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }

      // 3. Sync Phase / Battle Result
      if (action === 'sync') {
        const { matchId, phase, p1_hp, p2_hp, round, resetPoints } = data;
        let query = 'UPDATE zookeeper_matches SET last_update_ts = ?';
        const params = [now];

        if (phase) { query += ', phase = ?'; params.push(phase); }
        if (p1_hp !== undefined) { query += ', p1_hp = ?'; params.push(p1_hp); }
        if (p2_hp !== undefined) { query += ', p2_hp = ?'; params.push(p2_hp); }
        if (round !== undefined) { query += ', round = ?'; params.push(round); }
        if (resetPoints) {
           query += ', p1_atk = 0, p1_def = 0, p1_special = 0, p2_atk = 0, p2_def = 0, p2_special = 0';
        }
        if (winnerId) { query += ', winner_id = ?'; params.push(winnerId); }

        query += ' WHERE match_id = ?';
        params.push(matchId);

        await env.DB.prepare(query).bind(...params).run();
        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
      }
    }

    if (method === 'GET') {
      const matchId = url.searchParams.get('matchId');
      const userId = url.searchParams.get('userId');

      // 共通：待機人数をカウント（30秒以内の有効な待機者）
      const queueObj = await env.DB.prepare('SELECT COUNT(*) as count FROM zookeeper_queue WHERE joined_at > ?').bind(now - 30).first();
      const queueCount = queueObj ? queueObj.count : 0;

      if (matchId) {
        const match = await env.DB.prepare('SELECT * FROM zookeeper_matches WHERE match_id = ?').bind(matchId).first();
        return new Response(JSON.stringify({ ...match, queueCount }), { headers: corsHeaders });
      }

      if (userId) {
        // Check if user has been matched by someone else
        const match = await env.DB.prepare('SELECT * FROM zookeeper_matches WHERE (p1_id = ? OR p2_id = ?) AND phase != "finished" ORDER BY start_ts DESC LIMIT 1').bind(userId, userId).first();
        if (match) {
          return new Response(JSON.stringify({ status: 'matched', matchId: match.match_id, match, queueCount }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ status: 'waiting', queueCount }), { headers: corsHeaders });
      }

      // 公開情報の取得（マッチIDもユーザーIDもない場合）
      return new Response(JSON.stringify({ status: 'info', queueCount }), { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
