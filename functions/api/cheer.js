export async function onRequest(context) {
  const { request, env } = context;
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
    return new Response(JSON.stringify({ error: 'D1 database binding "DB" missing' }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  // Get date in JST (UTC+9)
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const dateStr = now.toISOString().split('T')[0];

  try {
    if (method === 'GET') {
      // 全メンバーの応援数を取得
      const countsData = await env.DB.prepare('SELECT * FROM member_cheers').all();
      const countsMap = {};
      countsData.results.forEach(row => {
        countsMap[row.member_id] = row.count;
      });

      // このIPが今日既に応援したかチェック
      const history = await env.DB.prepare('SELECT 1 FROM cheer_history WHERE ip = ? AND date = ?')
        .bind(ip, dateStr)
        .first();

      return new Response(JSON.stringify({
        counts: countsMap,
        hasCheeredToday: !!history
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (method === 'POST') {
      const data = await request.json();
      const { member_id } = data;

      if (!member_id) {
        return new Response('Missing member_id', { status: 400 });
      }

      // 1. 二重投稿チェック（DB側）
      try {
        await env.DB.prepare('INSERT INTO cheer_history (ip, date) VALUES (?, ?)').bind(ip, dateStr).run();
      } catch (e) {
        // ユニーク制約エラー（既に存在する場合）
        return new Response(JSON.stringify({ error: 'already_cheered', message: '今日は既に応援済みです✨' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // 2. カウントアップ（存在しなければ作成）
      await env.DB.prepare(`
        INSERT INTO member_cheers (member_id, count) 
        VALUES (?, 1) 
        ON CONFLICT(member_id) DO UPDATE SET count = count + 1
      `).bind(member_id).run();

      return new Response(JSON.stringify({ status: 'ok' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (err) {
    console.error('Cheer API Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}
