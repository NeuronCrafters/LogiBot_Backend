const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('/app/node_modules/pg');
const bcrypt = require('/app/node_modules/bcryptjs');
const { signSession } = require('/app/dist/http/auth');
const { getOrCreateRagCollection } = require('/app/dist/services/rag/chromaService');
const databaseUrl = new URL(process.env.DATABASE_URL);
assert.equal(databaseUrl.hostname, 'postgres');
assert.equal(databaseUrl.pathname, '/logibot');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const inherited = globalThis.languageLegacyFixture;
const ids = inherited || Object.fromEntries(['account', 'session', 'message', 'job', 'university', 'course', 'class', 'discipline', 'quiz'].map(key => [key, randomUUID()]));
const email = `language-legacy-${ids.account}@example.invalid`;
const password = randomBytes(24).toString('hex');
const results = [];
let cookie, documentId, collection, conversationSessionId;
const chromaIds = new Set();

async function check(name, fn, continueOnFailure = false) {
  const started = Date.now();
  try {
    results.push({ name, ok: true, ...(await fn()), elapsedMs: Date.now() - started });
    console.log(JSON.stringify(results.at(-1)));
  } catch (error) {
    results.push({ name, ok: false, error: error.message, elapsedMs: Date.now() - started });
    console.log(JSON.stringify(results.at(-1)));
    process.exitCode = 1;
    if (!continueOnFailure) throw new Error(`Falha em ${name}`);
  }
}

async function api(route, options = {}) {
  const headers = {};
  if (process.env.API_KEY) headers['x-api-key'] = process.env.API_KEY;
  if (options.auth !== false && cookie) headers.Cookie = cookie;
  if (options.language) headers['X-Language'] = options.language;
  if (options.accept) headers['Accept-Language'] = options.accept;
  Object.assign(headers, options.headers || {});
  let body;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  return fetch(`http://127.0.0.1:${process.env.PORT || 43187}` + route, { method: options.method || (body ? 'POST' : 'GET'), headers, body, signal: AbortSignal.timeout(120000) });
}
async function json(route, options, status = 200) {
  const response = await api(route, options);
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return { data, headers: response.headers };
}
async function preference(language) {
  return json('/account/preferences', { method: 'PATCH', language: 'pt-BR', body: { language } });
}
function assertLanguage(text, language) {
  assert.ok(text.trim().length > 25);
  const patterns = { 'pt-BR': /\b(uma|armazena|memória|programação|variável|prefixo|identificação)\b/i, 'en-US': /\b(the|is|stores|allows|memory|programming|prefix)\b/i, 'es-ES': /\b(una|almacena|memoria|programación|prefijo|identificación)\b/i };
  assert.match(text, patterns[language]);
}
async function waitForJob(jobId) {
  const deadline = Date.now() + 120000;
  let data;
  do {
    ({ data } = await json('/chat/jobs/' + jobId, { language: 'pt-BR' }));
    if (['done', 'failed'].includes(data.status)) return data;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  throw new Error('Timeout do job');
}

async function main() {
  if (!inherited) {
    await pool.query('insert into accounts(id,name,email) values($1,$2,$3)', [ids.account, 'Nome original em português', email]);
    await pool.query('insert into account_roles(account_id,role) values($1,$2)', [ids.account, 'admin']);
    await pool.query('insert into chat_sessions(id,user_id,session_id,title) values($1,$2,$3,$4)', [ids.session, ids.account, ids.session, 'Histórico original']);
    await pool.query('insert into chat_messages(id,chat_session_id,role,content,metadata) values($1,$2,$3,$4,$5)', [ids.message, ids.session, 'user', 'Mensagem original em português.', { legacy: true }]);
    await pool.query('insert into chat_generation_jobs(id,user_id,chat_session_id,user_message_id,status,error_message) values($1,$2,$3,$4,$5,$6)', [ids.job, ids.account, ids.session, ids.message, 'failed', 'falha legada de teste']);
    await pool.query('insert into universities(id,name) values($1,$2)', [ids.university, 'Universidade de teste de idiomas']);
    await pool.query('insert into courses(id,name,university_id) values($1,$2,$3)', [ids.course, 'Curso em português', ids.university]);
    await pool.query('insert into classes(id,name,course_id,registration_code) values($1,$2,$3,$4)', [ids.class, 'Turma em português', ids.course, ids.class]);
    await pool.query('insert into disciplines(id,name,course_id) values($1,$2,$3)', [ids.discipline, 'Lógica em português', ids.course]);
    await pool.query('insert into class_disciplines(class_id,discipline_id) values($1,$2)', [ids.class, ids.discipline]);
    await pool.query('insert into professor_quizzes(id,professor_id,discipline_id,title,topic,status) values($1,$2,$3,$4,$5,$6)', [ids.quiz, ids.account, ids.discipline, 'Quiz original em português', 'Variáveis', 'draft']);
  }
  cookie = 'token=' + signSession({ id: ids.account, name: 'Nome original em português', email, role: ['admin'] });
  await check('migracao-e-registros-legados', async () => {
    const account = (await pool.query('select name,preferred_language from accounts where id=$1', [ids.account])).rows[0];
    assert.equal(account.name, 'Nome original em português'); assert.equal(account.preferred_language, null);
    const quiz = (await pool.query('select title,language from professor_quizzes where id=$1', [ids.quiz])).rows[0];
    assert.equal(quiz.title, 'Quiz original em português'); assert.equal(quiz.language, null);
    const job = (await pool.query('select output_language,error_message from chat_generation_jobs where id=$1', [ids.job])).rows[0];
    assert.equal(job.output_language, 'pt-BR'); assert.equal(job.error_message, 'falha legada de teste');
    return { legacyRowsCreatedBeforeMigration: Boolean(inherited), preference: null, jobFallback: job.output_language, historicalQuizLanguage: null };
  });
  await check('navegador-negociacao-e-erros-concorrentes', async () => {
    const cases = [['en-US,en;q=0.9,pt;q=0.8', 'en-US', 'not authenticated: token missing'], ['es-MX,es;q=0.9', 'es-ES', 'sin autenticar: falta el token'], ['pt-PT', 'pt-BR', 'nao autenticado: token ausente']];
    await Promise.all(cases.map(async ([accept, expected, message]) => {
      const { data, headers } = await json('/auth/me', { auth: false, accept }, 401);
      assert.equal(headers.get('content-language'), expected); assert.equal(data.message, message); assert.equal(data.code, 'auth.tokenMissing');
    }));
    const { headers } = await json('/languages', { accept: 'de;q=1,en;q=0.8' }); assert.equal(headers.get('content-language'), 'en-US');
    return { languages: ['pt-BR', 'en-US', 'es-ES'], sameErrorCode: true };
  });
  await check('preferencia-persistencia-prioridade-e-reset', async () => {
    await preference('en-US');
    const saved = await json('/auth/me', { accept: 'pt-BR' }); assert.equal(saved.headers.get('content-language'), 'en-US'); assert.equal(saved.data.preferredLanguage, 'en-US'); assert.equal(saved.data.name, 'Nome original em português');
    const override = await json('/auth/me', { language: 'es-ES', accept: 'pt-BR' }); assert.equal(override.headers.get('content-language'), 'es-ES'); assert.equal(override.data.preferredLanguage, 'en-US');
    await pool.query('update accounts set password_hash=$1 where id=$2', [await bcrypt.hash(password, 10), ids.account]);
    const login = await json('/auth/session', { auth: false, accept: 'pt-BR', body: { email, password } }); assert.equal(login.headers.get('content-language'), 'en-US'); assert.equal(login.data.user.preferredLanguage, 'en-US');
    await json('/account/preferences', { method: 'PATCH', language: 'en-US', body: { language: 'de-DE' } }, 400);
    assert.equal((await pool.query('select preferred_language from accounts where id=$1', [ids.account])).rows[0].preferred_language, 'en-US');
    await preference(null); assert.equal((await json('/auth/me', { accept: 'es' })).headers.get('content-language'), 'es-ES');
    return { stored: true, explicitOverridesAccount: true, restoredOnLogin: true, resetUsesBrowser: true };
  });
  await check('cors-para-seletor-de-idioma', async () => {
    const response = await api('/account/preferences', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'Content-Type,X-Language,Accept-Language' } });
    assert.equal(response.status, 204); assert.match(response.headers.get('access-control-allow-headers'), /X-Language/i);
    const normal = await api('/auth/me', { language: 'en-US', headers: { Origin: 'http://localhost:5173' } }); assert.match(normal.headers.get('access-control-expose-headers'), /Content-Language/i);
    return { preflight: 204, responseHeaderExposed: true };
  });
  await check('historico-quiz-e-erros-legados-preservados', async () => {
    const history = await json(`/chat/sessions/${ids.account}/${ids.session}/messages`, { language: 'en-US' }); assert.equal(history.data[0].content, 'Mensagem original em português.'); assert.deepEqual(history.data[0].metadata, { legacy: true });
    const quizzes = await json('/quiz/professor', { language: 'en-US' }); const old = quizzes.data.find(quiz => quiz.id === ids.quiz); assert.equal(old.title, 'Quiz original em português'); assert.equal(old.language, null);
    const pt = await json('/chat/jobs/' + ids.job, { language: 'pt-BR' }); assert.equal(pt.data.errorMessage, 'falha legada de teste');
    const en = await json('/chat/jobs/' + ids.job, { language: 'en-US' }); assert.match(en.data.errorMessage, /could not complete/); assert.equal(en.data.outputLanguage, 'pt-BR');
    return { historicalTextUnchanged: true, legacyErrorLocalizedWithoutRewrite: true };
  });
  for (const language of ['pt-BR', 'en-US', 'es-ES']) {
    await check('streaming-' + language, async () => {
      const response = await api('/chat/messages/stream', { language, body: { message: 'Explique em duas frases o que é uma variável na programação.', sessionId: conversationSessionId } }); assert.equal(response.status, 200); assert.equal(response.headers.get('content-language'), language);
      const text = await response.text(); const events = text.split(/\r?\n\r?\n/).filter(event => event.startsWith('event:')).map(event => ({ event: event.match(/^event: (.+)/)[1], data: JSON.parse(event.match(/\ndata: (.+)/)[1]) }));
      assert.ok(!events.some(event => event.event === 'error'), JSON.stringify(events.filter(event => event.event === 'error')));
      const tokens = events.filter(event => event.event === 'token').map(event => event.data.text).join(''); assertLanguage(tokens, language); assert.equal(events.find(event => event.event === 'done').data.provider, 'openrouter');
      const sessionId = events.find(event => event.event === 'session').data.sessionId;
      if (conversationSessionId) assert.equal(sessionId, conversationSessionId);
      conversationSessionId = sessionId;
      const stored = (await json(`/chat/sessions/${ids.account}/${sessionId}/messages`, { language: 'pt-BR' })).data;
      assert.equal(stored.at(-1).metadata.outputLanguage, language); assert.equal(stored.at(-1).content, tokens.trim());
      assert.equal(stored[0].content, 'Explique em duas frases o que é uma variável na programação.');
      return { language, persisted: true, excerpt: tokens.slice(0, 280) };
    }, true);
  }
  for (const [index, language] of ['en-US', 'es-ES', 'en-US', 'es-ES'].entries()) {
    await check('job-idioma-fixado-' + language + '-' + index, async () => {
      const created = await json('/chat/messages', { language, body: { message: 'Explique em duas frases o que é uma variável na programação.' } }, 202);
      assert.equal(created.data.outputLanguage, language);
      await preference(language === 'en-US' ? 'es-ES' : 'pt-BR');
      const state = await waitForJob(created.data.jobId); assert.equal(state.status, 'done', state.errorMessage); assert.equal(state.outputLanguage, language);
      const stored = (await json(`/chat/sessions/${ids.account}/${created.data.sessionId}/messages`, { language: 'pt-BR' })).data;
      assert.equal(stored[1].metadata.outputLanguage, language); assert.equal(stored[1].content, state.responses[0].text);
      assertLanguage(state.responses[0].text, language);
      return { outputLanguage: state.outputLanguage, persistedLanguage: stored[1].metadata.outputLanguage, preferenceChanged: true, excerpt: state.responses[0].text.slice(0, 280) };
    }, true);
  }
  await preference(null);
  const material = 'Aula de variáveis do laboratório Aurora. O identificador do laboratório é AURORA-739. Os nomes das variáveis dos exemplos começam com o prefixo aurora_. Esta convenção vale apenas para a turma. Uma variável associa um nome a um valor. Em JavaScript let permite reatribuir valores e const impede a reatribuição do identificador. Const não impede alterar propriedades de um objeto. Uma condição if executa o bloco quando sua expressão é verdadeira; else executa quando ela é falsa. O operador === compara tipo e valor sem conversão implícita. O laço for usa inicialização, condição e atualização. O exemplo for (let aurora_i = 0; aurora_i < 3; aurora_i++) executa três vezes, para 0, 1 e 2. While testa sua condição antes de executar; do while testa depois e executa ao menos uma vez. Break encerra o laço atual. Continue pula o restante da iteração atual. Uma função pode receber parâmetros. Return devolve um valor e encerra a função; sem return explícito a função devolve undefined. A identificação da aula é AURORA-739 e o prefixo das variáveis é aurora_.';
  await check('ingestao-material-portugues-preservado', async () => {
    const form = new FormData(); form.append('title', 'Material original em português'); form.append('file', new Blob([material], { type: 'text/plain' }), 'material-idiomas.txt');
    documentId = (await json(`/rag/classes/${ids.class}/documents`, { language: 'en-US', form }, 201)).data.document.id;
    const deadline = Date.now() + 120000; let doc;
    do {
      doc = (await json(`/rag/classes/${ids.class}/documents`, { language: 'en-US' })).data.documents.find(item => item.id === documentId);
      if (doc.status === 'ready') break; if (doc.status === 'error') throw new Error(doc.errorMessage); await new Promise(resolve => setTimeout(resolve, 1000));
    } while (Date.now() < deadline);
    assert.equal(doc.status, 'ready'); assert.equal(doc.title, 'Material original em português');
    const rows = (await pool.query('select chroma_id from rag_document_chunks where document_id=$1', [documentId])).rows; rows.forEach(row => chromaIds.add(row.chroma_id)); collection = await getOrCreateRagCollection();
    return { titlePreserved: true, chunks: rows.length };
  });
  for (const [language, mode] of [['pt-BR', 'context'], ['en-US', 'context'], ['es-ES', 'context'], ['en-US', 'self'], ['en-US', 'hybrid']]) {
    await check(`rag-${mode}-${language}`, async () => {
      const { data, headers } = await json(`/rag/classes/${ids.class}/test-chat`, { language, body: { message: { 'pt-BR': 'Segundo o material da aula de variáveis do laboratório Aurora, qual prefixo inicia os nomes das variáveis e qual é a identificação do laboratório?', 'en-US': 'According to the Aurora lab variable lesson material, what prefix starts the variable names and what is the laboratory identifier?', 'es-ES': 'Según el material de la clase de variables del laboratorio Aurora, ¿qué prefijo inicia los nombres de las variables y cuál es la identificación del laboratorio?' }[language], override: { ragMode: mode, topK: 4, minScore: 40 } } });
      assert.equal(headers.get('content-language'), language); assert.match(data.provider, /openrouter/); assert.ok(data.retrievedChunks.length > 0); assert.ok(data.retrievedChunks.every(chunk => chunk.documentId === documentId)); assert.match(data.answer, /aurora_/i); assert.match(data.answer, /AURORA[\s\-‐‑‒–—]*739/i);
      assertLanguage(data.answer, language);
      return { language, provider: data.provider, sources: data.retrievedChunks.length, excerpt: data.answer.slice(0, 320) };
    }, true);
  }
  for (const language of ['en-US', 'es-ES']) {
    await check('quiz-conteudo-' + language, async () => {
      const { data, headers } = await json('/quiz/professor/generate-ai', { language: 'pt-BR', body: { disciplineId: ids.discipline, theme: 'Variáveis e controle de fluxo em JavaScript', questionCount: 3, documentIds: [documentId], language } }, 201);
      assert.equal(headers.get('content-language'), 'pt-BR'); assert.equal(data.quiz.language, language); assert.equal(data.quiz.status, 'draft'); assert.equal(data.questions.length, 3);
      data.questions.forEach(question => {
        assert.equal(question.options.length, 4); assert.match(question.correctOption, /^[ABCD]$/);
        assert.match(question.question, language === 'en-US' ? /\b(which|what|how|the|is|in|correct)\b/i : /\b(cuál|siguientes|qué|el|la|en|correcta|correcto)\b/i);
      });
      const audit = (await pool.query('select language from professor_quiz_ai_generations where quiz_id=$1', [data.quiz.id])).rows[0]; assert.equal(audit.language, language);
      return { outputLanguage: data.quiz.language, interfaceLanguage: headers.get('content-language'), title: data.quiz.title, question: data.questions[0].question };
    }, true);
  }
  const analysis = (await pool.query('insert into user_analyses(user_id,name,email,school_id,school_name,course_id,course_name,class_id,class_name,total_usage_time) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id', [ids.account, 'Nome original em português', email, ids.university, 'Universidade de teste de idiomas', ids.course, 'Curso em português', ids.class, 'Turma em português', 300])).rows[0];
  await pool.query("insert into analysis_sessions(analysis_id,session_start,session_end,session_duration,subject_counts_chat) values($1,now()-interval '5 minutes',now(),300,$2)", [analysis.id, { variaveis: 3 }]);
  for (const language of ['pt-BR', 'en-US', 'es-ES']) {
    await check('insights-cache-' + language, async () => {
      const body = { chart: 'usage', filters: { universityId: ids.university, classId: ids.class } };
      const first = (await json('/dashboard/insights/chart', { language, body })).data; assert.equal(first.language, language); assert.equal(first.cached, false); assert.ok(first.insight.length > 80);
      const second = (await json('/dashboard/insights/chart', { language, body })).data; assert.equal(second.cached, true); assert.equal(second.insight, first.insight);
      const heading = { 'pt-BR': 'Leitura principal', 'en-US': 'Main findings', 'es-ES': 'Lectura principal' }[language]; assert.ok(first.insight.includes(heading));
      return { language: first.language, cacheVerified: true, excerpt: first.insight.slice(0, 220) };
    }, true);
  }
  await check('conteudo-antigo-permanece-portugues', async () => {
    const message = (await pool.query('select content,metadata from chat_messages where id=$1', [ids.message])).rows[0]; assert.equal(message.content, 'Mensagem original em português.'); assert.deepEqual(message.metadata, { legacy: true });
    const quiz = (await pool.query('select title,topic,language from professor_quizzes where id=$1', [ids.quiz])).rows[0]; assert.equal(quiz.title, 'Quiz original em português'); assert.equal(quiz.topic, 'Variáveis'); assert.equal(quiz.language, null);
    return { unchanged: true };
  });
}

main().catch(error => { console.log(JSON.stringify({ fatal: true, error: error.message })); process.exitCode = 1; }).finally(async () => {
  try {
    if (!collection && documentId) collection = await getOrCreateRagCollection();
    if (collection && documentId) {
      const vectors = await collection.get({ where: { documentId } });
      if (vectors.ids.length) await collection.delete({ ids: vectors.ids });
    }
    await pool.query('delete from professor_quizzes where professor_id=$1', [ids.account]);
    await pool.query('delete from accounts where id=$1 and email=$2', [ids.account, email]);
    await pool.query('delete from universities where id=$1', [ids.university]);
    await fs.rm(path.join(process.env.RAG_UPLOAD_DIR, ids.class), { recursive: true, force: true });
    console.log(JSON.stringify({ cleanup: 'registros-e-vetores-temporarios-removidos' }));
  } catch (error) { console.log(JSON.stringify({ cleanupError: error.message })); process.exitCode = 1; }
  await pool.end();
  console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length }));
});
