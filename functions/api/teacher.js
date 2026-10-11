export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (env && env.quiz_db) {
      const results = await env.quiz_db.prepare('SELECT * FROM results ORDER BY id DESC').all();
      return new Response(JSON.stringify(results.results || []), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
