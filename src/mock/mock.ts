import { MongoClient, ObjectId } from 'mongodb';
// --- MUDANÇA AQUI ---
// A forma correta de importar e usar uma localidade específica
import { Faker, pt_BR } from '@faker-js/faker';
import 'dotenv/config';

// --- E AQUI ---
// Criamos uma instância do Faker configurada para Português do Brasil
const faker = new Faker({ locale: [pt_BR] });

// --- CONFIGURAÇÃO DA GERAÇÃO ---
const NUM_UNIVERSITIES = 4;
const NUM_COURSES_PER_UNI = 4;
const NUM_CLASSES_PER_COURSE = 4;
const NUM_STUDENTS_PER_CLASS = 30;

const SUBJECTS = ['variaveis', 'funcoes', 'loops', 'tipos', 'verificacoes', 'listas'];

// Interface para definir a estrutura do nosso documento
interface UserAnalysisDocument {
  _id: ObjectId;
  userId: string;
  name: string;
  email: string;
  schoolId: ObjectId;
  schoolName: string;
  courseId: ObjectId;
  courseName: string;
  classId: ObjectId;
  className: string;
  totalUsageTime: number;
  totalCorrectWrongAnswers: {
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
  };
  performanceBySubject: Record<string, { correct: number; wrong: number }>;
  sessions: {
    sessionStart: Date;
    answerHistory: {
      questions: {
        timestamp: Date;
        selectedOption: { isCorrect: boolean };
      }[];
    }[];
  }[];
}

async function seedDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ ERRO: MONGO_URI não encontrada no arquivo .env. Abortando.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  console.log('🚀 Iniciando script de seed em massa...');

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados com sucesso.');

    const db = client.db();

    // --- Adição do Usuário Admin ---
    console.log('🔑 Garantindo a existência do usuário admin...');
    const usersCollection = db.collection('users');
    const adminId = new ObjectId("677e9e92a0735cfd26a96c0a");

    await usersCollection.updateOne(
      { _id: adminId },
      {
        $set: {
          name: "admin",
          email: "ch47b07sa3l@gmail.com",
          password: "$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy",
          role: ["admin"],
          status: "active",
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          __v: 0,
        }
      },
      { upsert: true }
    );
    console.log('✅ Usuário admin garantido/atualizado.');

    const userAnalysisCollection = db.collection<UserAnalysisDocument>('useranalyses');

    console.log('🔥 Limpando a coleção "useranalyses" existente...');
    await userAnalysisCollection.deleteMany({});

    const allUsers: UserAnalysisDocument[] = [];

    console.log('🔄 Gerando dados para a população...');
    for (let i = 0; i < NUM_UNIVERSITIES; i++) {
      const universityId = new ObjectId();
      const universityName = faker.company.name() + ' University';

      for (let j = 0; j < NUM_COURSES_PER_UNI; j++) {
        const courseId = new ObjectId();
        const courseName = faker.commerce.department() + ' Digital';

        for (let k = 0; k < NUM_CLASSES_PER_COURSE; k++) {
          const classId = new ObjectId();
          const className = `${courseName.substring(0, 2).toUpperCase()}${2022 + k}`;

          for (let l = 0; l < NUM_STUDENTS_PER_CLASS; l++) {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const studentName = `${firstName} ${lastName}`;
            const studentEmail = faker.internet.email({ firstName, lastName, provider: 'fakemail.com' });

            const totalUsageTime = faker.number.int({ min: 300, max: 15000 });

            let totalCorrectAnswers = 0;
            let totalWrongAnswers = 0;
            const performanceBySubject: Record<string, { correct: number; wrong: number }> = {};

            SUBJECTS.forEach(subject => {
              const correct = faker.number.int({ min: 5, max: 50 });
              const wrong = faker.number.int({ min: 2, max: 30 });
              performanceBySubject[subject] = { correct, wrong };
              totalCorrectAnswers += correct;
              totalWrongAnswers += wrong;
            });

            const sessions = [];
            const numSessions = faker.number.int({ min: 1, max: 10 });
            for (let s = 0; s < numSessions; s++) {
              const sessionStart = faker.date.past({ years: 1 });
              sessions.push({
                sessionStart,
                answerHistory: [{
                  questions: [
                    { timestamp: faker.date.soon({ days: 1, refDate: sessionStart }), selectedOption: { isCorrect: faker.datatype.boolean() } },
                    { timestamp: faker.date.soon({ days: 2, refDate: sessionStart }), selectedOption: { isCorrect: faker.datatype.boolean() } }
                  ]
                }]
              });
            }

            const user: UserAnalysisDocument = {
              _id: new ObjectId(),
              userId: faker.string.uuid(),
              name: studentName,
              email: studentEmail,
              schoolId: universityId,
              schoolName: universityName,
              courseId: courseId,
              courseName: courseName,
              classId: classId,
              className: className,
              totalUsageTime,
              totalCorrectWrongAnswers: { totalCorrectAnswers, totalWrongAnswers },
              performanceBySubject,
              sessions
            };
            allUsers.push(user);
          }
        }
      }
    }

    const totalGenerated = NUM_UNIVERSITIES * NUM_COURSES_PER_UNI * NUM_CLASSES_PER_COURSE * NUM_STUDENTS_PER_CLASS;
    console.log(`📊 Dados gerados para ${totalGenerated} alunos.`);

    console.log('⏳ Inserindo dados na coleção "useranalyses" (pode levar um momento)...');
    await userAnalysisCollection.insertMany(allUsers);

    console.log(`\n🎉 SUCESSO! ${allUsers.length} documentos de alunos inseridos.`);
    console.log('O ambiente de teste está pronto.');

  } catch (err) {
    console.error('❌ ERRO durante o processo de seed:', err);
  } finally {
    await client.close();
    console.log('🔌 Conexão com o banco de dados fechada.');
  }
}

seedDB();