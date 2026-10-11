export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').toUpperCase().trim();

    if (!code) {
      return new Response(JSON.stringify({ error: 'کۆد پێتڤیە' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. QZ code check: ONLY for entering exam! Reject when checking results!
    if (code.startsWith('QZ-')) {
      return new Response(JSON.stringify({ 
        error: 'ئەڤ کودە بتنێ بۆ دەستپێکرنا ئەزمونێ یە',
        isExamCode: true
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Only allow RS- codes
    if (!code.startsWith('RS-')) {
      return new Response(JSON.stringify({ 
        error: 'تکایە کودێ ئەنجامی (RS-XXXX-XXXX) بنڤیسە!' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (env && env.quiz_db) {
      // First try submissions table
      let row = null;
      try {
        row = await env.quiz_db.prepare('SELECT * FROM submissions WHERE result_code = ?').bind(code).first();
      } catch (e) {}

      // Fallback to results table
      if (!row) {
        try {
          row = await env.quiz_db.prepare('SELECT * FROM results WHERE result_code = ?').bind(code).first();
        } catch (e) {}
      }

      if (row) {
        let answers = [];
        if (row.answers) {
          try { answers = typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers; } catch(e){}
        }
        return new Response(JSON.stringify({
          ...row,
          result_code: row.result_code,
          resultCode: row.result_code,
          exam_code_used: row.exam_code_used || row.exam_id,
          answers
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'ئەنجام نەهاتە دیتن!' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
