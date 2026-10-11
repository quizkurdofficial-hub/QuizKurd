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

    // 2. Only allow RS- codes!
    if (!code.startsWith('RS-')) {
      return new Response(JSON.stringify({ 
        error: 'تکایە کودێ ئەنجامی ب دروستی بنڤیسە (نموونە: RS-XXXX-XXXX)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let submission = null;
    if (env && env.quiz_db) {
      try {
        submission = await env.quiz_db.prepare(
          'SELECT * FROM submissions WHERE result_code = ?'
        ).bind(code).first();
      } catch (e) {}

      // Fallback to results table
      if (!submission) {
        try {
          const resRow = await env.quiz_db.prepare(
            'SELECT * FROM results WHERE result_code = ?'
          ).bind(code).first();
          if (resRow) {
            submission = {
              result_code: resRow.result_code,
              exam_code_used: resRow.exam_id,
              student_name: resRow.student_name,
              score: resRow.score,
              percent: resRow.percent,
              answers: '[]',
              created_at: resRow.created_at
            };
          }
        } catch (e) {}
      }
    }

    if (!submission) {
      return new Response(JSON.stringify({ error: 'ئەنجام ب ڤی کودی نەهاتە دیتن!' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let parsedAnswers = [];
    if (submission.answers) {
      try {
        parsedAnswers = typeof submission.answers === 'string' ? JSON.parse(submission.answers) : submission.answers;
      } catch (e) {
        parsedAnswers = [];
      }
    }

    return new Response(JSON.stringify({
      result_code: submission.result_code,
      resultCode: submission.result_code,
      exam_code_used: submission.exam_code_used || submission.exam_id,
      exam_id: submission.exam_code_used || submission.exam_id,
      student_name: submission.student_name,
      name: submission.student_name,
      score: submission.score,
      percent: submission.percent,
      answers: parsedAnswers,
      created_at: submission.created_at
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
