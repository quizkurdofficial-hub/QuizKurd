function generateResultCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) p1 += chars.charAt(Math.floor(Math.random() * chars.length));
  for (let i = 0; i < 4; i++) p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  return `RS-${p1}-${p2}`;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const examId = (body.exam_id || body.code || body.exam_code_used || '').toUpperCase().trim();
    const studentName = body.name || body.student_name || 'قوتابی';
    const score = String(body.score || '0');
    const percent = parseInt(body.percent !== undefined ? body.percent : 0, 10);
    const answers = typeof body.answers === 'string' ? body.answers : JSON.stringify(body.answers || []);

    const resultCode = generateResultCode();

    if (env && env.quiz_db) {
      // 1. Ensure submissions table exists with result_code UNIQUE, exam_code_used
      try {
        await env.quiz_db.prepare(`
          CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            result_code TEXT UNIQUE,
            exam_code_used TEXT,
            student_name TEXT,
            score TEXT,
            percent INTEGER,
            answers TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      } catch (e) {}

      // Insert into submissions table
      try {
        await env.quiz_db.prepare(
          'INSERT INTO submissions (result_code, exam_code_used, student_name, score, percent, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
        ).bind(resultCode, examId, studentName, score, percent, answers).run();
      } catch (e) {}

      // Also insert into results table for backward compatibility
      try {
        await env.quiz_db.prepare(
          'INSERT INTO results (exam_id, student_name, result_code, score, percent, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
        ).bind(examId, studentName, resultCode, score, percent).run();
      } catch (e) {}
    }

    return new Response(JSON.stringify({
      success: true,
      resultCode: resultCode,
      result_code: resultCode,
      exam_code_used: examId,
      exam_id: examId,
      name: studentName,
      student_name: studentName,
      score: score,
      percent: percent,
      answers: typeof answers === 'string' ? JSON.parse(answers) : answers
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
