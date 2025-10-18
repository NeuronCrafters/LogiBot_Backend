import { MongoClient, ObjectId } from 'mongodb';
import { Faker, pt_BR, en } from '@faker-js/faker';
import 'dotenv/config';

// Criamos uma instância do Faker com pt_BR e en como fallback
const faker = new Faker({ locale: [pt_BR, en] });

// --- CONFIGURAÇÃO DA GERAÇÃO ---
const NUM_UNIVERSITIES = 10;
const NUM_COURSES_PER_UNI = 5;
const NUM_CLASSES_PER_COURSE = 5;
const NUM_PROFESSORS_PER_CLASS = 5; // 5 professores por turma
const NUM_DISCIPLINES_PER_CLASS = 5; // 5 disciplinas por turma (1 professor por disciplina)
const NUM_STUDENTS_PER_CLASS = 30;
const NUM_SESSIONS_PER_STUDENT = { min: 5, max: 15 };
const NUM_QUESTIONS_PER_SESSION = { min: 10, max: 30 };

const SUBJECTS = ['variaveis', 'funcoes', 'loops', 'tipos', 'verificacoes', 'listas'];

// Lista expandida de nomes de disciplinas em português
const DISCIPLINE_NAMES = [
  'Programação Orientada a Objetos',
  'Estrutura de Dados',
  'Banco de Dados I',
  'Banco de Dados II',
  'Desenvolvimento Web Front-end',
  'Desenvolvimento Web Back-end',
  'Algoritmos Avançados',
  'Engenharia de Software',
  'Sistemas Operacionais',
  'Redes de Computadores',
  'Inteligência Artificial',
  'Segurança da Informação',
  'Compiladores',
  'Computação Gráfica',
  'Programação Mobile',
  'Arquitetura de Software',
  'DevOps e Cloud Computing',
  'Análise de Dados',
  'Machine Learning',
  'Desenvolvimento de Jogos',
  'Interface Humano-Computador',
  'Sistemas Distribuídos',
  'Programação Funcional',
  'Testes de Software',
  'Metodologias Ágeis'
];

// Níveis de dificuldade
const LEVELS = ['facil', 'medio', 'dificil'];

async function seedDB() {
  const uri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ ERRO: MONGO_URI_LOCAL ou MONGO_URI não encontrada no .env. Abortando.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  console.log('🚀 Iniciando script de seed completo com dados robustos...');

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados com sucesso.');
    const db = client.db();

    // --- 1. Limpeza Completa ---
    console.log('🔥 Limpando todas as coleções relevantes...');
    await Promise.all([
      db.collection('universities').deleteMany({}),
      db.collection('courses').deleteMany({}),
      db.collection('classes').deleteMany({}),
      db.collection('disciplines').deleteMany({}),
      db.collection('professors').deleteMany({}),
      db.collection('users').deleteMany({}),
      db.collection('useranalyses').deleteMany({}),
    ]);
    console.log('✅ Coleções limpas.');

    // --- 2. Criação do Admin (primeiro) ---
    console.log('🔑 Criando usuário admin...');
    const adminId = new ObjectId("677e9e92a0735cfd26a96c0a");
    const admin = {
      _id: adminId,
      name: "admin",
      email: "ch47b07sa3l@gmail.com",
      password: "$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy",
      previousPasswords: [],
      role: ["admin"],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection('users').insertOne(admin);
    console.log('✅ Admin criado com sucesso.');

    // Arrays para armazenar os documentos
    const allUniversities = [];
    const allCourses = [];
    const allClasses = [];
    const allProfessors = [];
    const allDisciplines = [];
    const allStudents = [];
    const allUserAnalyses = [];

    console.log('\n📊 Iniciando geração da estrutura acadêmica...');
    console.log(`   🏛️  ${NUM_UNIVERSITIES} universidades`);
    console.log(`   📚 ${NUM_UNIVERSITIES * NUM_COURSES_PER_UNI} cursos`);
    console.log(`   👥 ${NUM_UNIVERSITIES * NUM_COURSES_PER_UNI * NUM_CLASSES_PER_COURSE} turmas`);
    console.log(`   👨‍🏫 ${NUM_UNIVERSITIES * NUM_COURSES_PER_UNI * NUM_CLASSES_PER_COURSE * NUM_PROFESSORS_PER_CLASS} professores`);
    console.log(`   📖 ${NUM_UNIVERSITIES * NUM_COURSES_PER_UNI * NUM_CLASSES_PER_COURSE * NUM_DISCIPLINES_PER_CLASS} disciplinas`);
    console.log(`   🎓 ${NUM_UNIVERSITIES * NUM_COURSES_PER_UNI * NUM_CLASSES_PER_COURSE * NUM_STUDENTS_PER_CLASS} alunos\n`);

    let disciplineNameIndex = 0;

    // --- 3. PASSO 1: Criar Universidades ---
    console.log('🏛️  Criando universidades...');
    for (let i = 0; i < NUM_UNIVERSITIES; i++) {
      const universityId = new ObjectId();
      const university = {
        _id: universityId,
        name: `Universidade ${faker.company.name()} - ${faker.location.city()}`,
        courses: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      allUniversities.push(university);
    }
    console.log(`   ✅ ${allUniversities.length} universidades criadas`);

    // --- 4. PASSO 2: Criar Cursos ---
    console.log('📚 Criando cursos...');
    for (const university of allUniversities) {
      for (let j = 0; j < NUM_COURSES_PER_UNI; j++) {
        const courseId = new ObjectId();
        const course = {
          _id: courseId,
          name: `Bacharelado em ${faker.commerce.department()}`,
          university: university._id,
          classes: [],
          professors: [],
          disciplines: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        allCourses.push(course);
        university.courses.push(courseId);
      }
    }
    console.log(`   ✅ ${allCourses.length} cursos criados`);

    // --- 5. PASSO 3: Criar Turmas ---
    console.log('👥 Criando turmas...');
    for (const course of allCourses) {
      for (let k = 0; k < NUM_CLASSES_PER_COURSE; k++) {
        const classId = new ObjectId();
        const year = 2020 + k;
        const class_ = {
          _id: classId,
          name: `${course.name.substring(0, 3).toUpperCase()}${year}`,
          course: course._id,
          students: [],
          disciplines: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        allClasses.push(class_);
        course.classes.push(classId);
      }
    }
    console.log(`   ✅ ${allClasses.length} turmas criadas`);

    // --- 6. PASSO 4: Criar Professores ---
    console.log('👨‍🏫 Criando professores...');
    for (const class_ of allClasses) {
      const course = allCourses.find(c => c._id.equals(class_.course));
      const university = allUniversities.find(u => u._id.equals(course.university));

      for (let p = 0; p < NUM_PROFESSORS_PER_CLASS; p++) {
        const professorId = new ObjectId();
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const professor = {
          _id: professorId,
          name: `Prof. Dr. ${firstName} ${lastName}`,
          email: faker.internet.email({
            firstName,
            lastName,
            provider: 'university.edu'
          }).toLowerCase(),
          password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy',
          previousPasswords: [],
          role: ['professor'],
          status: 'active',
          school: university._id,
          courses: [course._id],
          classes: [class_._id],
          disciplines: [], // Será preenchido quando criar a disciplina
          students: [], // Será preenchido quando os alunos forem criados
          createdAt: new Date(),
          updatedAt: new Date()
        };

        allProfessors.push(professor);

        if (!course.professors.some(profId => profId.equals(professorId))) {
          course.professors.push(professorId);
        }
      }
    }
    console.log(`   ✅ ${allProfessors.length} professores criados`);

    // --- 7. PASSO 5: Criar Disciplinas (1 professor responsável por disciplina) ---
    console.log('📖 Criando disciplinas com professores responsáveis...');
    for (const class_ of allClasses) {
      const course = allCourses.find(c => c._id.equals(class_.course));

      // Pega os professores desta turma
      const classProfessors = allProfessors.filter(prof =>
        prof.classes.some(c => c.equals(class_._id))
      );

      for (let d = 0; d < NUM_DISCIPLINES_PER_CLASS; d++) {
        const disciplineId = new ObjectId();
        const disciplineName = DISCIPLINE_NAMES[disciplineNameIndex % DISCIPLINE_NAMES.length];
        disciplineNameIndex++;

        // Atribui um professor para esta disciplina
        const responsibleProfessor = classProfessors[d % classProfessors.length];

        const discipline = {
          _id: disciplineId,
          name: disciplineName,
          course: course._id,
          classes: [class_._id],
          professors: [responsibleProfessor._id], // Professor responsável
          students: [], // Será preenchido quando os alunos forem criados
          code: `${faker.string.alpha(3).toUpperCase()}${faker.number.int({ min: 100, max: 999 })}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        allDisciplines.push(discipline);
        class_.disciplines.push(disciplineId);
        course.disciplines.push(disciplineId);

        // Atualiza o professor com esta disciplina
        responsibleProfessor.disciplines.push(disciplineId);
      }
    }
    console.log(`   ✅ ${allDisciplines.length} disciplinas criadas`);

    // --- 8. PASSO 6: Criar Alunos ---
    console.log('🎓 Criando alunos...');
    let studentCount = 0;
    const totalStudents = allClasses.length * NUM_STUDENTS_PER_CLASS;

    for (const class_ of allClasses) {
      const course = allCourses.find(c => c._id.equals(class_.course));
      const university = allUniversities.find(u => u._id.equals(course.university));

      // Todas as disciplinas desta turma
      const classDisciplines = allDisciplines.filter(d =>
        class_.disciplines.some(cd => cd.equals(d._id))
      );

      for (let l = 0; l < NUM_STUDENTS_PER_CLASS; l++) {
        studentCount++;

        if (studentCount % 500 === 0) {
          console.log(`   ⏳ Processando aluno ${studentCount}/${totalStudents}...`);
        }

        const studentId = new ObjectId();
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const studentName = `${firstName} ${lastName}`;
        const studentEmail = faker.internet.email({
          firstName,
          lastName,
          provider: 'student.edu'
        }).toLowerCase();

        // Aluno se matricula em todas as disciplinas da turma
        const studentDisciplines = classDisciplines.map(d => d._id);

        const student = {
          _id: studentId,
          name: studentName,
          email: studentEmail,
          password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy',
          previousPasswords: [],
          role: ['student'],
          status: 'active',
          school: university._id,
          course: course._id,
          class: class_._id,
          disciplines: studentDisciplines,
          level: faker.helpers.arrayElement(['iniciante', 'intermediario', 'avancado']),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        allStudents.push(student);
        class_.students.push(studentId);

        // Atualiza disciplinas com este aluno
        classDisciplines.forEach(discipline => {
          discipline.students.push(studentId);
        });

        // Atualiza professores com este aluno
        const studentProfessors = allProfessors.filter(prof =>
          prof.disciplines.some(pd =>
            studentDisciplines.some(sd => sd.equals(pd))
          )
        );
        studentProfessors.forEach(prof => {
          if (!prof.students.some(s => s.equals(studentId))) {
            prof.students.push(studentId);
          }
        });
      }
    }
    console.log(`   ✅ ${allStudents.length} alunos criados`);

    // --- 9. PASSO 7: Criar UserAnalyses com BASTANTE dados ---
    console.log('📊 Criando análises detalhadas para cada aluno...');
    let analysisCount = 0;

    for (const student of allStudents) {
      analysisCount++;

      if (analysisCount % 500 === 0) {
        console.log(`   ⏳ Criando análise ${analysisCount}/${allStudents.length}...`);
      }

      const course = allCourses.find(c => c._id.equals(student.course));
      const university = allUniversities.find(u => u._id.equals(course.university));
      const class_ = allClasses.find(c => c._id.equals(student.class));

      // Performance por assunto principal
      let totalCorrectAnswers = 0;
      let totalWrongAnswers = 0;
      const performanceBySubject: Record<string, { correct: number; wrong: number }> = {};

      SUBJECTS.forEach(subject => {
        const correct = faker.number.int({ min: 20, max: 150 });
        const wrong = faker.number.int({ min: 10, max: 80 });
        performanceBySubject[subject] = { correct, wrong };
        totalCorrectAnswers += correct;
        totalWrongAnswers += wrong;
      });

      // Criar várias sessões realistas
      const sessions = [];
      const numSessions = faker.number.int(NUM_SESSIONS_PER_STUDENT);

      for (let s = 0; s < numSessions; s++) {
        const sessionStart = faker.date.past({ years: 1 });
        const sessionDuration = faker.number.int({ min: 600, max: 7200 }); // 10min a 2h
        const sessionEnd = new Date(sessionStart.getTime() + sessionDuration * 1000);

        const sessionCorrect = faker.number.int({ min: 5, max: 30 });
        const sessionWrong = faker.number.int({ min: 2, max: 15 });

        // Sub-contadores por assunto na sessão
        const subjectCountsChat = {
          variaveis: faker.number.int({ min: 0, max: 15 }),
          tipos: faker.number.int({ min: 0, max: 15 }),
          funcoes: faker.number.int({ min: 0, max: 15 }),
          loops: faker.number.int({ min: 0, max: 15 }),
          verificacoes: faker.number.int({ min: 0, max: 15 })
        };

        // Criar tentativas de quiz dentro da sessão
        const answerHistory = [];
        const numAttempts = faker.number.int({ min: 1, max: 4 });

        for (let a = 0; a < numAttempts; a++) {
          const questions = [];
          const numQuestions = faker.number.int(NUM_QUESTIONS_PER_SESSION);

          let attemptCorrect = 0;
          let attemptWrong = 0;

          for (let q = 0; q < numQuestions; q++) {
            const isCorrect = faker.datatype.boolean({ probability: 0.68 }); // 68% de acerto
            const subject = faker.helpers.arrayElement(SUBJECTS);
            const level = faker.helpers.arrayElement(LEVELS);

            questions.push({
              level,
              subject,
              selectedOption: {
                question: `Questão ${q + 1} sobre ${subject} - Nível ${level}`,
                isCorrect,
                isSelected: faker.helpers.arrayElement(['A', 'B', 'C', 'D', 'E'])
              },
              totalCorrectAnswers: isCorrect ? 1 : 0,
              totalWrongAnswers: isCorrect ? 0 : 1,
              timestamp: new Date(sessionStart.getTime() + faker.number.int({ min: 0, max: sessionDuration * 1000 }))
            });

            if (isCorrect) {
              attemptCorrect++;
            } else {
              attemptWrong++;
            }
          }

          answerHistory.push({
            questions,
            totalCorrectWrongAnswersSession: {
              totalCorrectAnswers: attemptCorrect,
              totalWrongAnswers: attemptWrong
            }
          });
        }

        sessions.push({
          sessionStart,
          sessionEnd,
          sessionDuration,
          lastActivityAt: sessionEnd,
          totalCorrectAnswers: sessionCorrect,
          totalWrongAnswers: sessionWrong,
          subjectCountsChat,
          answerHistory
        });
      }

      const userAnalysis = {
        _id: new ObjectId(),
        userId: student._id.toHexString(),
        name: student.name,
        email: student.email,
        schoolId: university._id,
        schoolName: university.name,
        courseId: course._id,
        courseName: course.name,
        classId: class_._id,
        className: class_.name,
        totalUsageTime: sessions.reduce((sum, s) => sum + s.sessionDuration, 0),
        totalCorrectWrongAnswers: {
          totalCorrectAnswers,
          totalWrongAnswers
        },
        subjectCountsQuiz: {
          variaveis: faker.number.int({ min: 15, max: 100 }),
          tipos: faker.number.int({ min: 15, max: 100 }),
          funcoes: faker.number.int({ min: 15, max: 100 }),
          loops: faker.number.int({ min: 15, max: 100 }),
          verificacoes: faker.number.int({ min: 15, max: 100 })
        },
        performanceBySubject,
        sessions
      };

      allUserAnalyses.push(userAnalysis);
    }
    console.log(`   ✅ ${allUserAnalyses.length} análises criadas`);

    // --- 10. Inserção em Massa na ordem correta ---
    console.log('\n⏳ Inserindo todos os documentos no banco de dados...');

    await db.collection('universities').insertMany(allUniversities);
    console.log(`   ✅ ${allUniversities.length} universidades inseridas`);

    await db.collection('courses').insertMany(allCourses);
    console.log(`   ✅ ${allCourses.length} cursos inseridos`);

    await db.collection('classes').insertMany(allClasses);
    console.log(`   ✅ ${allClasses.length} turmas inseridas`);

    await db.collection('professors').insertMany(allProfessors);
    console.log(`   ✅ ${allProfessors.length} professores inseridos`);

    await db.collection('disciplines').insertMany(allDisciplines);
    console.log(`   ✅ ${allDisciplines.length} disciplinas inseridas`);

    await db.collection('users').insertMany(allStudents);
    console.log(`   ✅ ${allStudents.length} alunos inseridos`);

    await db.collection('useranalyses').insertMany(allUserAnalyses);
    console.log(`   ✅ ${allUserAnalyses.length} análises inseridas`);

    console.log(`\n🎉 SUCESSO! Estrutura acadêmica completa criada:`);
    console.log(`   🏛️  ${allUniversities.length} universidades`);
    console.log(`   📚 ${allCourses.length} cursos`);
    console.log(`   👥 ${allClasses.length} turmas`);
    console.log(`   👨‍🏫 ${allProfessors.length} professores`);
    console.log(`   📖 ${allDisciplines.length} disciplinas`);
    console.log(`   🎓 ${allStudents.length} alunos`);
    console.log(`   📊 ${allUserAnalyses.length} análises de usuário`);
    console.log(`   🔑 1 administrador`);
    console.log('\n✨ O ambiente de teste está pronto com MUITOS dados!');

  } catch (err) {
    console.error('❌ ERRO durante o processo de seed:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Conexão com o banco de dados fechada.');
  }
}

seedDB();