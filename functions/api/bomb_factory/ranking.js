export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const { DB } = env;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST') {
        const data = await request.json();
        const { userId, name, score } = data;

        if (!userId || !name || score === undefined) {
            return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400, headers: corsHeaders });
        }

        try {
            await DB.prepare('INSERT INTO bomb_factory_scores (user_id, name, score, ts) VALUES (?, ?, ?, ?)')
                .bind(userId, name, score, Date.now())
                .run();
        } catch (e) {
            // 自動でテーブル作成を試みる（初回のみ）
            await DB.prepare('CREATE TABLE IF NOT EXISTS bomb_factory_scores (id INTEGER PRIMARY KEY, user_id TEXT, name TEXT, score INTEGER, ts INTEGER)').run();
            await DB.prepare('INSERT INTO bomb_factory_scores (user_id, name, score, ts) VALUES (?, ?, ?, ?)')
                .bind(userId, name, score, Date.now())
                .run();
        }

        return new Response(JSON.stringify({ status: 'ok' }), { headers: corsHeaders });
    }

    if (request.method === 'GET') {
        try {
            const results = await DB.prepare('SELECT name, score FROM bomb_factory_scores ORDER BY score DESC LIMIT 10')
                .all();
            return new Response(JSON.stringify({ ranking: results.results }), { headers: corsHeaders });
        } catch (e) {
            // テーブルがない場合は作成して空で返す
            await DB.prepare('CREATE TABLE IF NOT EXISTS bomb_factory_scores (id INTEGER PRIMARY KEY, user_id TEXT, name TEXT, score INTEGER, ts INTEGER)').run();
            return new Response(JSON.stringify({ ranking: [] }), { headers: corsHeaders });
        }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}
