"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongodb_1 = require("mongodb");
var faker_1 = require("@faker-js/faker");
require("dotenv/config");
// Criamos uma instância do Faker com pt_BR e en como fallback
var faker = new faker_1.Faker({ locale: [faker_1.pt_BR, faker_1.en] });
// --- CONFIGURAÇÃO EXCLUSIVA PARA TESTE LOCAL ---
var NUM_STUDENTS = 30;
var UNIVERSITY_NAME = "Universidade Pronatec";
var COURSE_NAME = "Bacharelado em Engenharia de Software";
var CLASS_NAME = "Turma 2025/1";
var MIN_TOTAL_QUIZ_QUESTIONS = 500;
var NUM_SESSIONS_PER_STUDENT = { min: 8, max: 20 };
var QUESTIONS_PER_SESSION_ATTEMPT = { min: 10, max: 30 };
var MIN_USAGE_TIME_SEC = 3600;
var MAX_USAGE_TIME_SEC = 10800;
var BASE_CORRECT_RATE = 0.65; // CONSTANTE DE TAXA DE ACERTO CORRIGIDA
// --- CONSTANTES DE ASSUNTO ---
var mainSubjects = ['variaveis', 'listas', 'condicionais', 'verificacoes', 'tipos', 'funcoes', 'loops'];
var ALL_MOCK_SUBJECTS_DETAILED = [
    'o_que_são_variáveis', 'o_que_são_listas', 'o_que_são_condicionais', 'verificações_avançadas', 'tipos_de_dados_primitivos', 'o_que_são_funções', 'estruturas_de_repetição',
    'operações_de_concatenacao_de_textos', 'manipulação_de_caracteres', 'aritmética_de_ponto_flutuante', 'operadores_matemáticos_avançados', 'soma_de_inteiros', 'subtracao_com_overflow',
    'multiplicacao_por_zero', 'divisao_inteira_em_c', 'resto_da_divisao_modulo', 'divisao_de_flutuantes', 'o_que_são_operadores_lógicos'
];
var MAIN_SUBJECTS_FOR_CHAT_COUNT = ['variaveis', 'tipos', 'funcoes', 'loops', 'verificacoes'];
var LEVELS = ['basico', 'medio', 'dificil'];
// --- FUNÇÕES DE AJUDA PARA GERAÇÃO DE DADOS MOCK ---
// Função auxiliar para obter um valor da distribuição normal (Gaussian)
function boxMullerTransform() {
    var u = 0, v = 0;
    while (u === 0)
        u = Math.random();
    while (v === 0)
        v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
function getGaussianRandom(mean, stdDev, min, max) {
    var result = mean + stdDev * boxMullerTransform();
    return Math.min(max, Math.max(min, result));
}
function generatePerformanceData(allSubjects) {
    var totalCorrect = 0;
    var totalWrong = 0;
    var performanceBySubject = {};
    var totalQuestions = Math.round(getGaussianRandom(MIN_TOTAL_QUIZ_QUESTIONS, 150, 200, 800));
    var questionsRemaining = totalQuestions;
    allSubjects.forEach(function (subject) {
        var questionsForTopic = Math.round(questionsRemaining / allSubjects.length * faker.number.float({ min: 0.8, max: 1.2 }));
        if (questionsForTopic < 5)
            return;
        var successRate = getGaussianRandom(0.60, 0.15, 0.40, 0.80);
        var correct = Math.round(questionsForTopic * successRate);
        var wrong = questionsForTopic - correct;
        performanceBySubject[subject] = { correct: correct, wrong: wrong };
        totalCorrect += correct;
        totalWrong += wrong;
        questionsRemaining -= questionsForTopic;
    });
    return { performanceBySubject: performanceBySubject, totalCorrectAnswers: totalCorrect, totalWrongAnswers: totalWrong };
}
function extractMainSubject(subject) {
    var mainKey = subject.split('_')[0] || subject;
    if (mainSubjects.includes(mainKey))
        return mainKey;
    if (['textos', 'caracteres', 'numeros', 'operadores', 'soma', 'subtracao', 'multiplicacao', 'divisao'].some(function (k) { return mainKey.includes(k); }))
        return 'tipos';
    return mainKey;
}
// CORREÇÃO: Recebe o objeto completo de performance como argumento
function generateSessionsAndHistory(performanceData, studentIndex) {
    var sessions = [];
    var quizCountByMainSubject = {};
    // Usa os totais da performanceData
    var remainingCorrect = performanceData.totalCorrectAnswers;
    var remainingWrong = performanceData.totalWrongAnswers;
    // Tempo de uso disperso
    var totalUsageTime = Math.round(getGaussianRandom(5400, 1800, MIN_USAGE_TIME_SEC, MAX_USAGE_TIME_SEC));
    var totalDurationSum = 0;
    var numSessions = faker.number.int(NUM_SESSIONS_PER_STUDENT);
    var _loop_1 = function (s) {
        var durationFactor = faker.number.float({ min: 0.1, max: 0.9 }) * (s === numSessions - 1 ? 1 : 0.8);
        var sessionDuration = Math.round((totalUsageTime - totalDurationSum) / (numSessions - s) * faker.number.float({ min: 0.8, max: 1.2 }));
        var sessionStart = faker.date.recent({ days: 30 });
        var sessionEnd = new Date(sessionStart.getTime() + sessionDuration * 1000);
        totalDurationSum += sessionDuration;
        var sessionCorrect = Math.min(faker.number.int({ min: 1, max: 30 }), Math.round(remainingCorrect / (numSessions - s) || 1));
        var sessionWrong = Math.min(faker.number.int({ min: 1, max: 30 }), Math.round(remainingWrong / (numSessions - s) || 1));
        remainingCorrect -= sessionCorrect;
        remainingWrong -= sessionWrong;
        // --- Geração do bloco answerHistory ---
        var attemptCorrect = 0;
        var attemptWrong = 0;
        var questions = [];
        var QUESTIONS_PER_ATTEMPT = faker.number.int(QUESTIONS_PER_SESSION_ATTEMPT);
        for (var q = 0; q < QUESTIONS_PER_ATTEMPT; q++) {
            // CORREÇÃO: Acesso direto à constante global
            var isCorrect = faker.datatype.boolean({ probability: BASE_CORRECT_RATE });
            var detailedSubject = faker.helpers.arrayElement(ALL_MOCK_SUBJECTS_DETAILED);
            var level = faker.helpers.arrayElement(LEVELS);
            questions.push({
                level: level,
                subject: detailedSubject,
                selectedOption: { question: "Quest\u00E3o sobre ".concat(detailedSubject), isCorrect: isCorrect, isSelected: faker.helpers.arrayElement(['A', 'B', 'C', 'D']) },
                totalCorrectAnswers: isCorrect ? 1 : 0, totalWrongAnswers: isCorrect ? 0 : 1,
                timestamp: faker.date.between({ from: sessionStart, to: sessionEnd })
            });
            if (isCorrect) {
                attemptCorrect++;
            }
            else {
                attemptWrong++;
            }
            var mainSubjectKey = extractMainSubject(detailedSubject);
            quizCountByMainSubject[mainSubjectKey] = (quizCountByMainSubject[mainSubjectKey] || 0) + 1;
        }
        var answerHistory = [{
                questions: questions,
                totalCorrectWrongAnswersSession: { totalCorrectAnswers: attemptCorrect, totalWrongAnswers: attemptWrong }
            }];
        var subjectCountsChat = {};
        MAIN_SUBJECTS_FOR_CHAT_COUNT.forEach(function (subject) {
            subjectCountsChat[subject] = faker.number.int({ min: 1, max: 5 });
        });
        sessions.push({
            sessionStart: sessionStart,
            sessionEnd: sessionEnd,
            sessionDuration: sessionDuration,
            lastActivityAt: sessionEnd,
            totalCorrectAnswers: sessionCorrect, totalWrongAnswers: sessionWrong,
            subjectCountsChat: subjectCountsChat,
            answerHistory: answerHistory
        });
    };
    for (var s = 0; s < numSessions; s++) {
        _loop_1(s);
    }
    var totalUsageTimeFinal = sessions.reduce(function (sum, s) { return sum + s.sessionDuration; }, 0);
    var subjectCountsQuiz = {};
    MAIN_SUBJECTS_FOR_CHAT_COUNT.forEach(function (subject) {
        subjectCountsQuiz[subject] = quizCountByMainSubject[subject] || 0;
    });
    return { sessions: sessions, totalUsageTime: totalUsageTimeFinal, subjectCountsQuiz: subjectCountsQuiz };
}
function seedDB() {
    return __awaiter(this, void 0, void 0, function () {
        var uri, client, db, adminId, admin, allStudents, allUserAnalyses, allProfessors, allDisciplines, universityId, courseId, classId, university, course, class_, professorId, professor, disciplineId, discipline, l, studentId, studentName, studentEmail, performanceResults, sessionResults, student, studentAnalysis, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    uri = process.env.MONGO_URI;
                    if (!uri) {
                        console.error('❌ ERRO: MONGO_URI não encontrada no .env. Abortando.');
                        process.exit(1);
                    }
                    client = new mongodb_1.MongoClient(uri);
                    console.log('🚀 Iniciando script de seed (Máximo Realismo 1x1x1x30)...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 15, 16, 18]);
                    return [4 /*yield*/, client.connect()];
                case 2:
                    _a.sent();
                    console.log('✅ Conectado ao banco de dados com sucesso.');
                    db = client.db();
                    // --- 1. Limpeza Completa ---
                    console.log('🔥 Limpando coleções relevantes...');
                    return [4 /*yield*/, Promise.all([
                            db.collection('universities').deleteMany({}), db.collection('courses').deleteMany({}),
                            db.collection('classes').deleteMany({}), db.collection('disciplines').deleteMany({}),
                            db.collection('professors').deleteMany({}), db.collection('users').deleteMany({}),
                            db.collection('useranalyses').deleteMany({}),
                        ])];
                case 3:
                    _a.sent();
                    console.log('✅ Coleções limpas.');
                    adminId = new mongodb_1.ObjectId("677e9e92a0735cfd26a96c0a");
                    admin = { _id: adminId, name: "admin", email: "ch47b07sa3l@gmail.com", password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy', previousPasswords: [], role: ["admin"], status: "active", createdAt: new Date(), updatedAt: new Date() };
                    return [4 /*yield*/, db.collection('users').insertOne(admin)];
                case 4:
                    _a.sent();
                    allStudents = [];
                    allUserAnalyses = [];
                    allProfessors = [];
                    allDisciplines = [];
                    universityId = new mongodb_1.ObjectId();
                    courseId = new mongodb_1.ObjectId();
                    classId = new mongodb_1.ObjectId();
                    university = { _id: universityId, name: UNIVERSITY_NAME, courses: [courseId], createdAt: new Date(), updatedAt: new Date() };
                    course = { _id: courseId, name: COURSE_NAME, university: universityId, classes: [classId], professors: [], disciplines: [], createdAt: new Date(), updatedAt: new Date() };
                    class_ = { _id: classId, name: CLASS_NAME, course: courseId, students: [], disciplines: [], createdAt: new Date(), updatedAt: new Date() };
                    professorId = new mongodb_1.ObjectId();
                    professor = { _id: professorId, name: "Prof. Dr. ".concat(faker.person.fullName()), email: faker.internet.email({ provider: 'professor.edu' }).toLowerCase(), password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy', previousPasswords: [], role: ['professor'], status: 'active', school: universityId, courses: [courseId], classes: [classId], disciplines: [], students: [], createdAt: new Date(), updatedAt: new Date() };
                    allProfessors.push(professor);
                    course.professors.push(professorId);
                    disciplineId = new mongodb_1.ObjectId();
                    discipline = { _id: disciplineId, name: "Matriz Desempenho-Esforço", course: courseId, classes: [classId], professors: [professorId], students: [], code: "TEST".concat(faker.number.int({ min: 100, max: 999 })), createdAt: new Date(), updatedAt: new Date() };
                    allDisciplines.push(discipline);
                    class_.disciplines.push(disciplineId);
                    course.disciplines.push(disciplineId);
                    professor.disciplines.push(disciplineId);
                    // Inserções da estrutura
                    return [4 /*yield*/, db.collection('universities').insertOne(university)];
                case 5:
                    // Inserções da estrutura
                    _a.sent();
                    return [4 /*yield*/, db.collection('courses').insertOne(course)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, db.collection('classes').insertOne(class_)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, db.collection('professors').insertMany(allProfessors)];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, db.collection('disciplines').insertMany(allDisciplines)];
                case 9:
                    _a.sent();
                    console.log(" \u00A0 \u2705 Estrutura acad\u00EAmica m\u00EDnima criada.");
                    // --- 4. Criação dos 30 Alunos e Análises ---
                    for (l = 0; l < NUM_STUDENTS; l++) {
                        studentId = new mongodb_1.ObjectId();
                        studentName = "Aluno ".concat(l + 1, " - ").concat(faker.person.fullName());
                        studentEmail = faker.internet.email({ provider: 'aluno-teste.edu' }).toLowerCase();
                        performanceResults = generatePerformanceData(ALL_MOCK_SUBJECTS_DETAILED);
                        sessionResults = generateSessionsAndHistory(performanceResults, l);
                        student = {
                            _id: studentId, name: studentName, email: studentEmail, password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy', previousPasswords: [], role: ['student'], status: 'active',
                            school: universityId, course: courseId, class: classId, disciplines: [disciplineId],
                            level: faker.helpers.arrayElement(['iniciante', 'intermediario', 'avancado']),
                            createdAt: new Date(), updatedAt: new Date()
                        };
                        allStudents.push(student);
                        class_.students.push(studentId);
                        discipline.students.push(studentId);
                        professor.students.push(studentId);
                        studentAnalysis = {
                            _id: new mongodb_1.ObjectId(), userId: studentId.toHexString(), name: student.name, email: student.email,
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
                    return [4 /*yield*/, db.collection('professors').updateOne({ _id: professorId }, { $set: { students: professor.students, disciplines: professor.disciplines } })];
                case 10:
                    // --- 5. Atualizações e Inserções Finais ---
                    _a.sent();
                    return [4 /*yield*/, db.collection('disciplines').updateOne({ _id: disciplineId }, { $set: { students: discipline.students } })];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, db.collection('classes').updateOne({ _id: classId }, { $set: { students: class_.students } })];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, db.collection('users').insertMany(allStudents)];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, db.collection('useranalyses').insertMany(allUserAnalyses)];
                case 14:
                    _a.sent();
                    console.log("\n\uD83C\uDF89 SEED LOCAL CONCLU\u00CDDO!");
                    console.log(" \u00A0 Estrutura: ".concat(UNIVERSITY_NAME, " > ").concat(COURSE_NAME, " > ").concat(CLASS_NAME));
                    console.log(" \u00A0 Alunos Inseridos: ".concat(NUM_STUDENTS));
                    return [3 /*break*/, 18];
                case 15:
                    err_1 = _a.sent();
                    console.error('❌ ERRO durante o processo de seed:', err_1);
                    process.exit(1);
                    return [3 /*break*/, 18];
                case 16: return [4 /*yield*/, client.close()];
                case 17:
                    _a.sent();
                    console.log('🔌 Conexão com o banco de dados fechada.');
                    return [7 /*endfinally*/];
                case 18: return [2 /*return*/];
            }
        });
    });
}
seedDB();
