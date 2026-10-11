export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const data = await request.json();
    
    // Validate
    const title = data.title || 'تاقیکرن';
    const questions = typeof data.questions === 'string' ? data.questions : JSON.stringify(data.questions || []);
    // status: 'draft' | 'preview' | 'active' | 'closed'
    const status = data.status || 'draft';
    
    // Generate or use ID
    const rand = Math.floor(1000 + Math.random() * 9000);
    const id = (data.id || data.code || `QZ-${rand}`).toUpperCase();

    if (env && env.quiz_db) {
      try {
        await env.quiz_db.prepare("ALTER TABLE exams ADD COLUMN status TEXT DEFAULT 'draft'").run();
      } catch (e) {
        // column may already exist
      }

      if (data.questions !== undefined) {
        await env.quiz_db.prepare(
          'INSERT OR REPLACE INTO exams (id, title, questions, status) VALUES (?, ?, ?, ?)'
        ).bind(id, title, questions, status).run();
      } else {
        await env.quiz_db.prepare(
          'UPDATE exams SET status = ? WHERE id = ?'
        ).bind(status, id).run();
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      id, 
      code: id, 
      title, 
      status, 
      questions: JSON.parse(questions) 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').toUpperCase().trim();
    const role = (url.searchParams.get('role') || '').toLowerCase().trim(); // 'teacher' | 'preview'

    if (!code) {
      return new Response(JSON.stringify({ error: 'کۆد پێتڤیە' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let exam = null;
    if (env && env.quiz_db) {
      const res = await env.quiz_db.prepare('SELECT * FROM exams WHERE id = ?').bind(code).first();
      if (res) {
        exam = {
          id: res.id,
          code: res.id,
          title: res.title,
          status: res.status || 'draft',
          questions: typeof res.questions === 'string' ? JSON.parse(res.questions) : res.questions
        };
      }
    }

    if (!exam) {
      return new Response(JSON.stringify({ error: 'کۆدێ ئەزمونێ خەلەتە!' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only when status='active' students can enter with QZ code.
    if (role !== 'teacher' && role !== 'preview' && exam.status !== 'active') {
      const isClosed = exam.status === 'closed';
      return new Response(JSON.stringify({
        error: isClosed
          ? '🔒 ئەڤ تاقیکرنە هاتە داخستن (Status: Closed)'
          : `⚠️ ئەڤ ئەزموونە هێشتا نەهاتیە کاراکرن ژ لایێ مامۆستای ڤە (Status: ${exam.status || 'draft'})! Only active exams can be entered.`,
        status: exam.status,
        notActive: true
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(exam), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
