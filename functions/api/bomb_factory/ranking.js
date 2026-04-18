export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const { DB } = env;

    if (request.method === 'POST') {
        const data = await request.json();
        const { userId, name, score } = data;

        if (!userId || !name || score === undefined) {
            return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });
        }

        // スコアを保存
        await DB.prepare('INSERT INTO bomb_factory_scores (user_id, name, score, ts) VALUES (?, ?, ?, ?)')
            .bind(userId, name, score, Date.now())
            .run();

        return new Response(JSON.stringify({ status: 'ok' }));
    }

    if (request.method === 'GET') {
        // TOP 10 を取得
        const results = await DB.prepare('SELECT name, score FROM bomb_factory_scores ORDER BY score DESC LIMIT 10')
            .all();

        return new Response(JSON.stringify({ ranking: results.results }));
    }

    return new Response('Method not allowed', { status: 405 });
}
