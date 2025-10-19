import { MongoClient, ObjectId } from 'mongodb';
import { Faker, pt_BR, en } from '@faker-js/faker';
import 'dotenv/config';

// Criamos uma instância do Faker com pt_BR e en como fallback
const faker = new Faker({ locale: [pt_BR, en] });

// --- CONFIGURAÇÃO EXCLUSIVA PARA TESTE LOCAL ---
const NUM_STUDENTS = 30;
const UNIVERSITY_NAME = "Universidade Pronatec";
const COURSE_NAME = "Bacharelado em Engenharia de Software";
const CLASS_NAME = "Turma 2025/1";

const MIN_TOTAL_QUIZ_QUESTIONS = 500;
const NUM_SESSIONS_PER_STUDENT = { min: 8, max: 20 };
const QUESTIONS_PER_SESSION_ATTEMPT = { min: 10, max: 30 };
const MIN_USAGE_TIME_SEC = 3600;
const MAX_USAGE_TIME_SEC = 10800;
const BASE_CORRECT_RATE = 0.65; // CONSTANTE DE TAXA DE ACERTO CORRIGIDA

// --- CONSTANTES DE ASSUNTO ---
const mainSubjects = ['variaveis', 'listas', 'condicionais', 'verificacoes', 'tipos', 'funcoes', 'loops'];
const ALL_MOCK_SUBJECTS_DETAILED = [
  'o_que_são_variáveis', 'o_que_são_listas', 'o_que_são_condicionais', 'verificações_avançadas', 'tipos_de_dados_primitivos', 'o_que_são_funções', 'estruturas_de_repetição',
  'operações_de_concatenacao_de_textos', 'manipulação_de_caracteres', 'aritmética_de_ponto_flutuante', 'operadores_matemáticos_avançados', 'soma_de_inteiros', 'subtracao_com_overflow',
  'multiplicacao_por_zero', 'divisao_inteira_em_c', 'resto_da_divisao_modulo', 'divisao_de_flutuantes', 'o_que_são_operadores_lógicos'
];
const MAIN_SUBJECTS_FOR_CHAT_COUNT = ['variaveis', 'tipos', 'funcoes', 'loops', 'verificacoes'];
const LEVELS = ['basico', 'medio', 'dificil'];


// --- FUNÇÕES DE AJUDA PARA GERAÇÃO DE DADOS MOCK ---

// Função auxiliar para obter um valor da distribuição normal (Gaussian)
function boxMullerTransform() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getGaussianRandom(mean: number, stdDev: number, min: number, max: number) {
  let result = mean + stdDev * boxMullerTransform();
  return Math.min(max, Math.max(min, result));
}


function generatePerformanceData(allSubjects: string[]) {
  let totalCorrect = 0;
  let totalWrong = 0;
  const performanceBySubject: Record<string, { correct: number; wrong: number }> = {};
  const totalQuestions = Math.round(getGaussianRandom(MIN_TOTAL_QUIZ_QUESTIONS, 150, 200, 800));
  let questionsRemaining = totalQuestions;

  allSubjects.forEach(subject => {
    const questionsForTopic = Math.round(questionsRemaining / allSubjects.length * faker.number.float({ min: 0.8, max: 1.2 }));
    if (questionsForTopic < 5) return;

    const successRate = getGaussianRandom(0.60, 0.15, 0.40, 0.80);

    const correct = Math.round(questionsForTopic * successRate);
    const wrong = questionsForTopic - correct;

    performanceBySubject[subject] = { correct, wrong };
    totalCorrect += correct;
    totalWrong += wrong;
    questionsRemaining -= questionsForTopic;
  });

  return { performanceBySubject, totalCorrectAnswers: totalCorrect, totalWrongAnswers: totalWrong };
}

function extractMainSubject(subject: string): string {
  const mainKey = subject.split('_')[0] || subject;
  if (mainSubjects.includes(mainKey as any)) return mainKey;
  if (['textos', 'caracteres', 'numeros', 'operadores', 'soma', 'subtracao', 'multiplicacao', 'divisao'].some(k => mainKey.includes(k))) return 'tipos';
  return mainKey;
}

// CORREÇÃO: Recebe o objeto completo de performance como argumento
function generateSessionsAndHistory(performanceData: ReturnType<typeof generatePerformanceData>, studentIndex: number) {
  const sessions = [];
  const quizCountByMainSubject: Record<string, number> = {};

  // Usa os totais da performanceData
  let remainingCorrect = performanceData.totalCorrectAnswers;
  let remainingWrong = performanceData.totalWrongAnswers;

  // Tempo de uso disperso
  const totalUsageTime = Math.round(getGaussianRandom(5400, 1800, MIN_USAGE_TIME_SEC, MAX_USAGE_TIME_SEC));
  let totalDurationSum = 0;
  const numSessions = faker.number.int(NUM_SESSIONS_PER_STUDENT);


  for (let s = 0; s < numSessions; s++) {
    const durationFactor = faker.number.float({ min: 0.1, max: 0.9 }) * (s === numSessions - 1 ? 1 : 0.8);
    const sessionDuration = Math.round((totalUsageTime - totalDurationSum) / (numSessions - s) * faker.number.float({ min: 0.8, max: 1.2 }));

    const sessionStart = faker.date.recent({ days: 30 });
    const sessionEnd = new Date(sessionStart.getTime() + sessionDuration * 1000);

    totalDurationSum += sessionDuration;

    const sessionCorrect = Math.min(faker.number.int({ min: 1, max: 30 }), Math.round(remainingCorrect / (numSessions - s) || 1));
    const sessionWrong = Math.min(faker.number.int({ min: 1, max: 30 }), Math.round(remainingWrong / (numSessions - s) || 1));

    remainingCorrect -= sessionCorrect;
    remainingWrong -= sessionWrong;

    // --- Geração do bloco answerHistory ---
    let attemptCorrect = 0;
    let attemptWrong = 0;
    const questions = [];
    const QUESTIONS_PER_ATTEMPT = faker.number.int(QUESTIONS_PER_SESSION_ATTEMPT);
    for (let q = 0; q < QUESTIONS_PER_ATTEMPT; q++) {
      // CORREÇÃO: Acesso direto à constante global
      const isCorrect = faker.datatype.boolean({ probability: BASE_CORRECT_RATE });
      const detailedSubject = faker.helpers.arrayElement(ALL_MOCK_SUBJECTS_DETAILED);
      const level = faker.helpers.arrayElement(LEVELS);

      questions.push({
        level, subject: detailedSubject,
        selectedOption: { question: `Questão sobre ${detailedSubject}`, isCorrect, isSelected: faker.helpers.arrayElement(['A', 'B', 'C', 'D']) },
        totalCorrectAnswers: isCorrect ? 1 : 0, totalWrongAnswers: isCorrect ? 0 : 1,
        timestamp: faker.date.between({ from: sessionStart, to: sessionEnd })
      });

      if (isCorrect) { attemptCorrect++; } else { attemptWrong++; }

      const mainSubjectKey = extractMainSubject(detailedSubject);
      quizCountByMainSubject[mainSubjectKey] = (quizCountByMainSubject[mainSubjectKey] || 0) + 1;
    }

    const answerHistory = [{
      questions,
      totalCorrectWrongAnswersSession: { totalCorrectAnswers: attemptCorrect, totalWrongAnswers: attemptWrong }
    }];

    const subjectCountsChat: Record<string, number> = {};
    MAIN_SUBJECTS_FOR_CHAT_COUNT.forEach(subject => {
      subjectCountsChat[subject] = faker.number.int({ min: 1, max: 5 });
    });

    sessions.push({
      sessionStart, sessionEnd, sessionDuration, lastActivityAt: sessionEnd,
      totalCorrectAnswers: sessionCorrect, totalWrongAnswers: sessionWrong,
      subjectCountsChat, answerHistory
    });
  }

  const totalUsageTimeFinal = sessions.reduce((sum, s) => sum + s.sessionDuration, 0);

  const subjectCountsQuiz: Record<string, number> = {};
  MAIN_SUBJECTS_FOR_CHAT_COUNT.forEach(subject => {
    subjectCountsQuiz[subject] = quizCountByMainSubject[subject] || 0;
  });


  return { sessions, totalUsageTime: totalUsageTimeFinal, subjectCountsQuiz };
}


async function seedDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ ERRO: MONGO_URI não encontrada no .env. Abortando.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  console.log('🚀 Iniciando script de seed (Máximo Realismo 1x1x1x30)...');

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados com sucesso.');
    const db = client.db();

    // --- 1. Limpeza Completa ---
    console.log('🔥 Limpando coleções relevantes...');
    await Promise.all([
      db.collection('universities').deleteMany({}), db.collection('courses').deleteMany({}),
      db.collection('classes').deleteMany({}), db.collection('disciplines').deleteMany({}),
      db.collection('professors').deleteMany({}), db.collection('users').deleteMany({}),
      db.collection('useranalyses').deleteMany({}),
    ]);
    console.log('✅ Coleções limpas.');

    // --- 2. Criação do Admin ---
    const adminId = new ObjectId("677e9e92a0735cfd26a96c0a");
    const admin = { _id: adminId, name: "admin", email: "ch47b07sa3l@gmail.com", password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy', previousPasswords: [], role: ["admin"], status: "active", createdAt: new Date(), updatedAt: new Date() };
    await db.collection('users').insertOne(admin);

    // Arrays para inserção em massa
    const allStudents = []; const allUserAnalyses = []; const allProfessors = []; const allDisciplines = [];

    // --- 3. Criação da Estrutura Mínima (1x1x1) ---

    // 3.1 Entidades (Universidade, Curso, Turma)
    const universityId = new ObjectId(); const courseId = new ObjectId(); const classId = new ObjectId();
    const university = { _id: universityId, name: UNIVERSITY_NAME, courses: [courseId], createdAt: new Date(), updatedAt: new Date() };
    const course = { _id: courseId, name: COURSE_NAME, university: universityId, classes: [classId], professors: [], disciplines: [], createdAt: new Date(), updatedAt: new Date() };
    const class_ = { _id: classId, name: CLASS_NAME, course: courseId, students: [], disciplines: [], createdAt: new Date(), updatedAt: new Date() };

    // 3.2 Professor
    const professorId = new ObjectId();
    const professor = { _id: professorId, name: `Prof. Dr. ${faker.person.fullName()}`, email: faker.internet.email({ provider: 'professor.edu' }).toLowerCase(), password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy', previousPasswords: [], role: ['professor'], status: 'active', school: universityId, courses: [courseId], classes: [classId], disciplines: [], students: [], createdAt: new Date(), updatedAt: new Date() };
    allProfessors.push(professor); course.professors.push(professorId);

    // 3.3 Disciplina
    const disciplineId = new ObjectId();
    const discipline = { _id: disciplineId, name: "Matriz Desempenho-Esforço", course: courseId, classes: [classId], professors: [professorId], students: [], code: `TEST${faker.number.int({ min: 100, max: 999 })}`, createdAt: new Date(), updatedAt: new Date() };
    allDisciplines.push(discipline); class_.disciplines.push(disciplineId); course.disciplines.push(disciplineId); professor.disciplines.push(disciplineId);

    // Inserções da estrutura
    await db.collection('universities').insertOne(university);
    await db.collection('courses').insertOne(course);
    await db.collection('classes').insertOne(class_);
    await db.collection('professors').insertMany(allProfessors);
    await db.collection('disciplines').insertMany(allDisciplines);

    console.log(`   ✅ Estrutura acadêmica mínima criada.`);

    // --- 4. Criação dos 30 Alunos e Análises ---

    for (let l = 0; l < NUM_STUDENTS; l++) {
      const studentId = new ObjectId();
      const studentName = `Aluno ${l + 1} - ${faker.person.fullName()}`;
      const studentEmail = faker.internet.email({ provider: 'aluno-teste.edu' }).toLowerCase();

      // 4.1. GERAÇÃO DE TODOS OS DADOS DE DESEMPENHO E SESSÃO
      // A taxa de acerto global é dispersa aqui (l/NUM_STUDENTS)
      const performanceResults = generatePerformanceData(ALL_MOCK_SUBJECTS_DETAILED);

      // CORREÇÃO: Passando o objeto completo de performance e o índice do loop
      const sessionResults = generateSessionsAndHistory(performanceResults, l);


      // 4.2. Documento de Aluno (users)
      const student = {
        _id: studentId, name: studentName, email: studentEmail, password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy', previousPasswords: [], role: ['student'], status: 'active',
        school: universityId, course: courseId, class: classId, disciplines: [disciplineId],
        level: faker.helpers.arrayElement(['iniciante', 'intermediario', 'avancado']),
        createdAt: new Date(), updatedAt: new Date()
      };
      allStudents.push(student);
      class_.students.push(studentId); discipline.students.push(studentId); professor.students.push(studentId);

      // 4.3. Documento de Análise (useranalyses)
      const studentAnalysis = {
        _id: new ObjectId(), userId: studentId.toHexString(), name: student.name, email: student.email,
        schoolId: universityId, schoolName: university.name, courseId: courseId, courseName: course.name,
        classId: classId, className: class_.name,
        totalUsageTime: sessionResults.totalUsageTime,
        totalCorrectWrongAnswers: { totalCorrectAnswers: performanceResults.totalCorrectAnswers, totalWrongAnswers: performanceResults.totalWrongAnswers },
        subjectCountsQuiz: sessionResults.subjectCountsQuiz,
        performanceBySubject: performanceResults.performanceBySubject,
        sessions: sessionResults.sessions
      };
      allUserAnalyses.push(studentAnalysis);
    }

    // --- 5. Atualizações e Inserções Finais ---
    await db.collection('professors').updateOne({ _id: professorId }, { $set: { students: professor.students, disciplines: professor.disciplines } });
    await db.collection('disciplines').updateOne({ _id: disciplineId }, { $set: { students: discipline.students } });
    await db.collection('classes').updateOne({ _id: classId }, { $set: { students: class_.students } });

    await db.collection('users').insertMany(allStudents);
    await db.collection('useranalyses').insertMany(allUserAnalyses);

    console.log(`\n🎉 SEED LOCAL CONCLUÍDO!`);
    console.log(`   Estrutura: ${UNIVERSITY_NAME} > ${COURSE_NAME} > ${CLASS_NAME}`);
    console.log(`   Alunos Inseridos: ${NUM_STUDENTS}`);
  } catch (err) {
    console.error('❌ ERRO durante o processo de seed:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Conexão com o banco de dados fechada.');
  }
}

seedDB();