import bcrypt from "bcryptjs";
import { and, count, eq, inArray } from "drizzle-orm";
import { closeDatabasePool, getExpressDb } from "./client";
import {
  accountRoles,
  accounts,
  analysisSessions,
  answerAttempts,
  answerQuestions,
  chatMessages,
  chatSessions,
  chatTopicCounts,
  classDisciplines,
  classes,
  courses,
  disciplines,
  feedbacks,
  professorDisciplines,
  professorQuizAnswers,
  professorQuizAttempts,
  professorQuizQuestions,
  professorQuizzes,
  professorStudents,
  studentProfiles,
  universities,
  userAnalyses,
} from "./schema";

const SEED_IDS = {
  university: "00000000-0000-4000-8000-000000000101",
  course: "00000000-0000-4000-8000-000000000102",
  classes: [
    "00000000-0000-4000-8000-000000000103",
    "00000000-0000-4000-8000-000000000108",
    "00000000-0000-4000-8000-000000000109",
  ],
};

const REQUIRED_ACCOUNTS = [
  "admin@logibot.com",
  "professor@logibot.com",
  "coordenador@logibot.com",
  "aluno@logibot.com",
  "vitoria@logibot.com",
  "marcus@logibot.com",
];

const PROFESSOR_EMAIL = "professor@logibot.com";
const STUDENT_COUNT = 36;
const STUDENTS_PER_CLASS = 12;
const SESSION_COUNT_PER_STUDENT = 8;
const ATTEMPT_COUNT_PER_STUDENT = 6;
const CHAT_COUNT_PER_STUDENT = 3;
const CHAT_TURNS_PER_SESSION = 3;
const QUESTIONS_PER_QUIZ = 5;

type BehaviorProfile = "high" | "progressive" | "struggling" | "irregular";

type QuizQuestionTemplate = {
  question: string;
  options: string[];
  correctOption: string;
  explanation: string;
};

type TopicDefinition = {
  key: string;
  disciplineName: string;
  quizTitles: [string, string];
  questions: QuizQuestionTemplate[];
  chatQuestions: string[];
  chatAnswers: string[];
};

function deterministicUuid(namespace: string, index: number) {
  const head = `${namespace}${"0".repeat(7)}`.slice(0, 8);
  return `${head}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function assertInvariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invariante do seed2 violada: ${message}`);
}

function dateDaysAgo(baseDate: Date, daysAgo: number, hour: number, minute = 0) {
  return new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate() - daysAgo,
      hour,
      minute,
      0,
      0,
    ),
  );
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

const TOPICS: TopicDefinition[] = [
  {
    key: "variaveis",
    disciplineName: "Variáveis e Tipos",
    quizTitles: ["Fundamentos de Variáveis", "Variáveis na Prática"],
    questions: [
      {
        question: "Qual é a principal finalidade de uma variável em programação?",
        options: [
          "Armazenar um valor que pode ser utilizado pelo programa",
          "Executar o sistema operacional",
          "Criar uma conexão física de rede",
          "Substituir todas as funções",
          "Impedir a entrada de dados",
        ],
        correctOption: "A",
        explanation:
          "Variáveis guardam valores para que eles possam ser consultados ou alterados durante a execução.",
      },
      {
        question: "Qual nome de variável segue uma convenção comum e legível?",
        options: [
          "2nota",
          "nota_final",
          "nota-final!",
          "class",
          "nota final",
        ],
        correctOption: "B",
        explanation:
          "nota_final começa com uma letra e usa sublinhado para separar palavras.",
      },
      {
        question: "Qual tipo é mais adequado para representar uma idade inteira?",
        options: ["boolean", "string", "integer", "array", "date"],
        correctOption: "C",
        explanation: "Idades inteiras são normalmente representadas por um integer.",
      },
      {
        question: "O que ocorre em uma atribuição como total = 10?",
        options: [
          "A variável é removida",
          "O número é impresso automaticamente",
          "Uma função é declarada",
          "O valor 10 é armazenado em total",
          "O programa é encerrado",
        ],
        correctOption: "D",
        explanation: "A atribuição associa o valor 10 à variável total.",
      },
      {
        question: "Qual valor representa um dado booleano?",
        options: ["42", "3.14", "texto", "[1, 2]", "verdadeiro"],
        correctOption: "E",
        explanation: "Booleanos representam estados verdadeiro ou falso.",
      },
    ],
    chatQuestions: [
      "Como posso escolher bons nomes para variáveis?",
      "Qual é a diferença entre inteiro e número decimal?",
      "Pode explicar atribuição de variáveis com um exemplo?",
    ],
    chatAnswers: [
      "Prefira nomes que descrevam o dado, como total_pedidos ou nota_final, e mantenha um padrão consistente.",
      "Inteiros não possuem casas decimais; números de ponto flutuante representam valores como 7,5.",
      "Em pontos = 10, o valor 10 é guardado na variável pontos e pode ser reutilizado depois.",
    ],
  },
  {
    key: "listas",
    disciplineName: "Listas e Coleções",
    quizTitles: ["Introdução a Listas", "Operações com Listas"],
    questions: [
      {
        question: "Para que uma lista é utilizada?",
        options: [
          "Guardar vários valores em uma estrutura ordenada",
          "Compilar o sistema operacional",
          "Criar somente valores booleanos",
          "Bloquear repetições",
          "Definir uma condição obrigatória",
        ],
        correctOption: "A",
        explanation:
          "Listas agrupam vários valores e normalmente preservam uma ordem.",
      },
      {
        question: "Em muitas linguagens, qual é o índice do primeiro item?",
        options: ["-1", "0", "1", "2", "10"],
        correctOption: "B",
        explanation: "A indexação de listas geralmente começa em zero.",
      },
      {
        question: "Qual operação normalmente adiciona um item ao final da lista?",
        options: ["delete", "sort", "append", "close", "return"],
        correctOption: "C",
        explanation: "append é um nome comum para adicionar um item ao final.",
      },
      {
        question: "Qual expressão acessa o terceiro elemento de uma lista indexada em zero?",
        options: ["lista[0]", "lista[1]", "lista[3]", "lista[2]", "lista[-3]"],
        correctOption: "D",
        explanation: "O terceiro elemento ocupa o índice 2.",
      },
      {
        question: "Qual ação percorre todos os elementos de uma lista?",
        options: [
          "Uma atribuição simples",
          "Uma comparação única",
          "Uma importação",
          "Uma conversão booleana",
          "Um laço de repetição",
        ],
        correctOption: "E",
        explanation: "Laços permitem visitar os elementos da coleção.",
      },
    ],
    chatQuestions: [
      "Como acesso uma posição específica de uma lista?",
      "Como adiciono um novo item em uma lista?",
      "Pode mostrar como percorrer todos os itens de uma lista?",
    ],
    chatAnswers: [
      "Use o índice entre colchetes. Em uma lista iniciada em zero, itens[0] acessa o primeiro elemento.",
      "Em Python, use lista.append(valor). Outras linguagens oferecem operações equivalentes.",
      "Um laço for pode visitar cada elemento, por exemplo: for item in itens.",
    ],
  },
  {
    key: "condicionais",
    disciplineName: "Estruturas Condicionais",
    quizTitles: ["Decisões com Condicionais", "Condições Compostas"],
    questions: [
      {
        question: "Qual estrutura executa um bloco quando uma condição é verdadeira?",
        options: ["if", "import", "class", "return", "print"],
        correctOption: "A",
        explanation: "A estrutura if avalia uma condição antes de executar o bloco.",
      },
      {
        question: "Qual palavra representa o caminho alternativo de um if?",
        options: ["while", "else", "break", "const", "input"],
        correctOption: "B",
        explanation: "else é executado quando a condição anterior não é satisfeita.",
      },
      {
        question: "Qual operador verifica igualdade em muitas linguagens?",
        options: ["=", "=>", "==", "+=", "!="],
        correctOption: "C",
        explanation: "== costuma ser usado para comparar igualdade; = realiza atribuição.",
      },
      {
        question: "Quando uma condição idade >= 18 é verdadeira?",
        options: [
          "Somente quando idade é zero",
          "Quando idade é menor que 18",
          "Quando idade é texto",
          "Quando idade é 18 ou maior",
          "Nunca",
        ],
        correctOption: "D",
        explanation: "O operador >= significa maior ou igual.",
      },
      {
        question: "Para testar várias faixas em sequência, qual composição é adequada?",
        options: [
          "Apenas uma variável",
          "Somente um comentário",
          "Uma lista vazia",
          "Uma função sem retorno",
          "if, else if/elif e else",
        ],
        correctOption: "E",
        explanation: "Uma cadeia condicional permite avaliar alternativas em ordem.",
      },
    ],
    chatQuestions: [
      "Quando devo usar if e else?",
      "Como faço uma condição com mais de uma alternativa?",
      "Qual é a diferença entre atribuição e comparação em uma condição?",
    ],
    chatAnswers: [
      "Use if para o caminho condicionado e else para o caminho alternativo quando a condição for falsa.",
      "Encadeie if, elif/else if e else, colocando primeiro as condições mais específicas.",
      "Atribuição guarda um valor; comparação verifica a relação entre valores e produz verdadeiro ou falso.",
    ],
  },
  {
    key: "funcoes",
    disciplineName: "Funções e Modularização",
    quizTitles: ["Fundamentos de Funções", "Parâmetros e Retorno"],
    questions: [
      {
        question: "Qual é um benefício central de utilizar funções?",
        options: [
          "Reutilizar e organizar trechos de lógica",
          "Eliminar todos os dados",
          "Impedir o uso de parâmetros",
          "Substituir qualquer condição",
          "Executar apenas uma vez",
        ],
        correctOption: "A",
        explanation: "Funções encapsulam comportamentos reutilizáveis.",
      },
      {
        question: "O que é um parâmetro de função?",
        options: [
          "Um erro de compilação",
          "Um valor de entrada declarado pela função",
          "Uma lista obrigatoriamente vazia",
          "O nome do arquivo",
          "Uma condição de parada",
        ],
        correctOption: "B",
        explanation: "Parâmetros descrevem os dados que a função espera receber.",
      },
      {
        question: "Qual palavra é frequentemente usada para devolver um resultado?",
        options: ["break", "continue", "return", "switch", "case"],
        correctOption: "C",
        explanation: "return encerra a função e entrega um resultado ao chamador.",
      },
      {
        question: "Uma função sem retorno explícito normalmente produz o quê?",
        options: [
          "Sempre o número zero",
          "Sempre verdadeiro",
          "Uma lista automática",
          "Um valor nulo/indefinido conforme a linguagem",
          "Um erro obrigatório",
        ],
        correctOption: "D",
        explanation:
          "Muitas linguagens retornam um valor nulo ou indefinido quando não há retorno explícito.",
      },
      {
        question: "Qual prática melhora a clareza de uma função?",
        options: [
          "Misturar muitas responsabilidades",
          "Evitar nomes descritivos",
          "Usar variáveis globais sempre",
          "Duplicar código",
          "Manter uma responsabilidade bem definida",
        ],
        correctOption: "E",
        explanation: "Funções focadas são mais fáceis de entender, testar e reutilizar.",
      },
    ],
    chatQuestions: [
      "Por que devo dividir meu código em funções?",
      "Como funcionam parâmetros e argumentos?",
      "Quando uma função deve usar return?",
    ],
    chatAnswers: [
      "Funções reduzem repetição, dão nomes às etapas do programa e facilitam testes.",
      "Parâmetros aparecem na definição; argumentos são os valores enviados na chamada.",
      "Use return quando o resultado precisa ser aproveitado por outra parte do programa.",
    ],
  },
  {
    key: "operadores_logicos",
    disciplineName: "Lógica Booleana",
    quizTitles: ["Operadores Lógicos", "Expressões Booleanas"],
    questions: [
      {
        question: "Quando a expressão A AND B é verdadeira?",
        options: [
          "Quando A e B são verdadeiras",
          "Quando apenas A é verdadeira",
          "Quando apenas B é verdadeira",
          "Quando ambas são falsas",
          "Em qualquer situação",
        ],
        correctOption: "A",
        explanation: "AND exige que todas as condições sejam verdadeiras.",
      },
      {
        question: "Quando a expressão A OR B é verdadeira?",
        options: [
          "Somente quando ambas são falsas",
          "Quando pelo menos uma condição é verdadeira",
          "Somente quando A é falsa",
          "Nunca",
          "Somente com números",
        ],
        correctOption: "B",
        explanation: "OR exige que ao menos uma das condições seja verdadeira.",
      },
      {
        question: "Qual operador inverte um valor booleano?",
        options: ["AND", "OR", "NOT", "XOR", "MOD"],
        correctOption: "C",
        explanation: "NOT transforma verdadeiro em falso e falso em verdadeiro.",
      },
      {
        question: "Qual é o resultado de verdadeiro AND falso?",
        options: ["verdadeiro", "nulo", "indefinido", "falso", "1"],
        correctOption: "D",
        explanation: "AND só é verdadeiro quando os dois lados são verdadeiros.",
      },
      {
        question: "Parênteses em uma expressão lógica servem para quê?",
        options: [
          "Apagar variáveis",
          "Criar uma lista",
          "Converter tudo em texto",
          "Impedir comparações",
          "Definir a ordem de avaliação",
        ],
        correctOption: "E",
        explanation: "Parênteses deixam explícita a precedência das operações.",
      },
    ],
    chatQuestions: [
      "Pode explicar o operador AND com um exemplo?",
      "Qual é a diferença entre AND e OR?",
      "Como usar NOT em uma expressão lógica?",
    ],
    chatAnswers: [
      "AND é útil quando todas as regras precisam ser satisfeitas, como idade >= 18 AND possui_documento.",
      "AND exige todas as condições verdadeiras; OR aceita que pelo menos uma seja verdadeira.",
      "NOT inverte a condição. Se ativo é verdadeiro, NOT ativo resulta em falso.",
    ],
  },
];

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Camila",
  "Daniel",
  "Eduarda",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabela",
  "João",
  "Karina",
  "Lucas",
  "Mariana",
  "Nicolas",
  "Olívia",
  "Paulo",
  "Rafaela",
  "Samuel",
  "Tatiane",
  "Vinícius",
  "Amanda",
  "Caio",
  "Débora",
  "Enzo",
  "Fernanda",
  "Gustavo",
  "Helena",
  "Igor",
  "Júlia",
  "Leandro",
  "Manuela",
  "Otávio",
  "Patrícia",
  "Renato",
  "Sofia",
  "Tiago",
];

const LAST_NAMES = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Costa",
  "Pereira",
  "Rodrigues",
  "Almeida",
  "Nascimento",
  "Lima",
  "Araújo",
  "Fernandes",
];

const PROFILE_SCORES: Record<BehaviorProfile, number[]> = {
  high: [4, 4, 5, 4, 5, 5],
  progressive: [1, 2, 2, 3, 4, 5],
  struggling: [1, 2, 1, 2, 1, 2],
  irregular: [4, 2, 5, 1, 4, 3],
};

const SESSION_DAY_OFFSETS = [84, 68, 51, 36, 24, 13, 6, 1];
const ATTEMPT_SESSION_INDEXES = [0, 1, 2, 4, 5, 7];
const CHAT_SESSION_INDEXES = [2, 5, 7];
const LEVELS = ["iniciante", "intermediario", "avancado"];
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

function profileForStudent(studentIndex: number): BehaviorProfile {
  return (["high", "progressive", "struggling", "irregular"] as const)[
    studentIndex % 4
  ];
}

function sessionDurationMinutes(
  profile: BehaviorProfile,
  studentIndex: number,
  sessionIndex: number,
) {
  const variant = Math.floor(studentIndex / 4) % 2;
  const baseByProfile: Record<BehaviorProfile, [number, number]> = {
    high: [18, 52],
    progressive: [48, 31],
    struggling: [58, 16],
    irregular: [22, 45],
  };
  const duration =
    baseByProfile[profile][variant] + ((studentIndex + sessionIndex * 3) % 9);
  return CHAT_SESSION_INDEXES.includes(sessionIndex)
    ? Math.max(duration, 30 + ((studentIndex + sessionIndex) % 6))
    : duration;
}

function wrongOption(correctOption: string, rotation: number) {
  const correctIndex = OPTION_LETTERS.indexOf(correctOption);
  return OPTION_LETTERS[(correctIndex + 1 + (rotation % 4)) % 5];
}

async function validateBaseSeed() {
  const db = getExpressDb();
  const [[university], [course], classRows, accountRows] = await Promise.all([
    db
      .select({ id: universities.id, name: universities.name })
      .from(universities)
      .where(eq(universities.id, SEED_IDS.university))
      .limit(1),
    db
      .select({ id: courses.id, name: courses.name })
      .from(courses)
      .where(eq(courses.id, SEED_IDS.course))
      .limit(1),
    db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(inArray(classes.id, SEED_IDS.classes)),
    db
      .select({ id: accounts.id, email: accounts.email })
      .from(accounts)
      .where(inArray(accounts.email, REQUIRED_ACCOUNTS)),
  ]);

  const missing: string[] = [];
  if (!university) missing.push("universidade base");
  if (!course) missing.push("curso base");
  for (const classId of SEED_IDS.classes) {
    if (!classRows.some((row) => row.id === classId))
      missing.push(`turma ${classId}`);
  }
  for (const email of REQUIRED_ACCOUNTS) {
    if (!accountRows.some((row) => row.email === email))
      missing.push(`conta ${email}`);
  }

  if (missing.length) {
    throw new Error(
      `O db:seed2 depende do db:seed. Execute "npm run db:seed" primeiro. Itens ausentes: ${missing.join(", ")}.`,
    );
  }

  const professor = accountRows.find((row) => row.email === PROFESSOR_EMAIL);
  assertInvariant(professor, "professor principal não encontrado");
  return {
    university,
    course,
    classes: SEED_IDS.classes.map((classId) => {
      const classItem = classRows.find((row) => row.id === classId);
      assertInvariant(classItem, `turma base ${classId} não encontrada`);
      return classItem;
    }),
    professor,
  };
}

async function buildStudentAccounts(baseDate: Date) {
  const rows = [];
  for (let index = 0; index < STUDENT_COUNT; index++) {
    const number = index + 1;
    const email = `aluno.seed2.${number.toString().padStart(2, "0")}@logibot.com`;
    rows.push({
      id: deterministicUuid("1", number),
      name: `${FIRST_NAMES[index]} ${LAST_NAMES[index % LAST_NAMES.length]}`,
      email,
      passwordHash: await bcrypt.hash(email, 10),
      status: "active",
      createdAt: dateDaysAgo(baseDate, 120 - (index % 18), 12),
      updatedAt: baseDate,
      lastFeedbackAt:
        index < 18 ? dateDaysAgo(baseDate, 1 + (index % 15), 14) : null,
    });
  }
  return rows;
}

async function seedDemoData() {
  const baseSeed = await validateBaseSeed();
  const professor = baseSeed.professor;
  const db = getExpressDb();
  const baseDate = new Date();
  baseDate.setUTCHours(12, 0, 0, 0);

  const studentAccountRows = await buildStudentAccounts(baseDate);
  const studentIds = studentAccountRows.map((student) => student.id);
  const disciplineIds = TOPICS.map((_, index) =>
    deterministicUuid("2", index + 1),
  );
  const quizIds = Array.from({ length: TOPICS.length * 2 }, (_, index) =>
    deterministicUuid("3", index + 1),
  );

  const summary = await db.transaction(async (tx) => {
    await tx.delete(accounts).where(inArray(accounts.id, studentIds));
    await tx
      .delete(professorQuizzes)
      .where(inArray(professorQuizzes.id, quizIds));
    await tx
      .delete(disciplines)
      .where(inArray(disciplines.id, disciplineIds));

    await tx.insert(accounts).values(studentAccountRows);
    await tx.insert(accountRoles).values(
      studentIds.map((accountId) => ({ accountId, role: "student" })),
    );

    const studentProfileRows = studentIds.map((accountId, index) => ({
      accountId,
      schoolId: SEED_IDS.university,
      courseId: SEED_IDS.course,
      classId: SEED_IDS.classes[Math.floor(index / STUDENTS_PER_CLASS)],
      level: LEVELS[index % LEVELS.length],
    }));
    await tx.insert(studentProfiles).values(studentProfileRows);
    await tx.insert(professorStudents).values(
      studentIds.map((studentId) => ({
        professorId: professor.id,
        studentId,
      })),
    );

    const disciplineRows = TOPICS.map((topic, index) => ({
      id: disciplineIds[index],
      name: topic.disciplineName,
      courseId: SEED_IDS.course,
      createdAt: dateDaysAgo(baseDate, 110 - index, 12),
      updatedAt: baseDate,
    }));
    await tx.insert(disciplines).values(disciplineRows);
    await tx.insert(classDisciplines).values(
      SEED_IDS.classes.flatMap((classId) =>
        disciplineIds.map((disciplineId) => ({ classId, disciplineId })),
      ),
    );
    await tx.insert(professorDisciplines).values(
      disciplineIds.map((disciplineId) => ({
        professorId: professor.id,
        disciplineId,
      })),
    );

    const quizRows: Array<typeof professorQuizzes.$inferInsert> = [];
    const quizQuestionRows: Array<typeof professorQuizQuestions.$inferInsert> =
      [];
    const questionsByQuiz = new Map<
      string,
      Array<
        QuizQuestionTemplate & {
          id: string;
          quizId: string;
          orderIndex: number;
        }
      >
    >();

    let quizIndex = 0;
    let questionIndex = 0;
    for (let topicIndex = 0; topicIndex < TOPICS.length; topicIndex++) {
      const topic = TOPICS[topicIndex];
      for (let variant = 0; variant < 2; variant++) {
        const id = quizIds[quizIndex];
        const isDraft = quizIndex === 3 || quizIndex === 9;
        quizRows.push({
          id,
          professorId: professor.id,
          disciplineId: disciplineIds[topicIndex],
          classId: null,
          generationSource: variant === 0 ? "manual" : "ai",
          title: topic.quizTitles[variant],
          topic: topic.key,
          description: `Quiz demonstrativo sobre ${topic.disciplineName.toLowerCase()}.`,
          status: isDraft ? "draft" : "published",
          createdAt: dateDaysAgo(baseDate, 96 - quizIndex * 6, 11),
          updatedAt: dateDaysAgo(baseDate, Math.max(1, 90 - quizIndex * 6), 16),
        });

        const currentQuestions = topic.questions.map((question, orderIndex) => {
          questionIndex++;
          const row = {
            id: deterministicUuid("4", questionIndex),
            quizId: id,
            question: question.question,
            options: question.options,
            correctOption: question.correctOption,
            explanation: question.explanation,
            orderIndex,
          };
          quizQuestionRows.push(row);
          return { ...question, id: row.id, quizId: id, orderIndex };
        });
        questionsByQuiz.set(id, currentQuestions);
        quizIndex++;
      }
    }

    await tx.insert(professorQuizzes).values(quizRows);
    await tx.insert(professorQuizQuestions).values(quizQuestionRows);

    const publishedQuizzes = quizRows.filter((quiz) => quiz.status === "published");
    assertInvariant(publishedQuizzes.length === 8, "devem existir 8 quizzes publicados");

    const userAnalysisRows: Array<typeof userAnalyses.$inferInsert> = [];
    const analyticsSessionRows: Array<typeof analysisSessions.$inferInsert> = [];
    const professorAttemptRows: Array<typeof professorQuizAttempts.$inferInsert> =
      [];
    const professorAnswerRows: Array<typeof professorQuizAnswers.$inferInsert> =
      [];
    const analyticsAttemptRows: Array<typeof answerAttempts.$inferInsert> = [];
    const answerQuestionRows: Array<typeof answerQuestions.$inferInsert> = [];
    const chatSessionRows: Array<typeof chatSessions.$inferInsert> = [];
    const chatMessageRows: Array<typeof chatMessages.$inferInsert> = [];
    const chatTopicCountRows: Array<typeof chatTopicCounts.$inferInsert> = [];
    const feedbackRows: Array<typeof feedbacks.$inferInsert> = [];

    let professorAttemptIndex = 0;
    let professorAnswerIndex = 0;
    let analyticsAttemptIndex = 0;
    let answerQuestionIndex = 0;
    let chatSessionIndex = 0;
    let chatMessageIndex = 0;

    for (let studentIndex = 0; studentIndex < STUDENT_COUNT; studentIndex++) {
      const student = studentAccountRows[studentIndex];
      const classIndex = Math.floor(studentIndex / STUDENTS_PER_CLASS);
      const profile = profileForStudent(studentIndex);
      const analysisId = deterministicUuid("5", studentIndex + 1);
      const sessionRowsForStudent: Array<typeof analysisSessions.$inferInsert> =
        [];
      const subjectCountsQuiz: Record<string, number> = {};
      const chatCounts: Record<string, number> = {};

      for (
        let sessionIndex = 0;
        sessionIndex < SESSION_COUNT_PER_STUDENT;
        sessionIndex++
      ) {
        const daysAgo =
          SESSION_DAY_OFFSETS[sessionIndex] + ((studentIndex + sessionIndex) % 3);
        const hour = 7 + ((studentIndex * 3 + sessionIndex * 4) % 16);
        const minute = (studentIndex * 7 + sessionIndex * 11) % 50;
        const start = dateDaysAgo(baseDate, daysAgo, hour, minute);
        const durationMinutes = sessionDurationMinutes(
          profile,
          studentIndex,
          sessionIndex,
        );
        const end = addMinutes(start, durationMinutes);
        sessionRowsForStudent.push({
          id: deterministicUuid(
            "6",
            studentIndex * SESSION_COUNT_PER_STUDENT + sessionIndex + 1,
          ),
          analysisId,
          sessionStart: start,
          sessionEnd: end,
          sessionDuration: durationMinutes * 60,
          lastActivityAt: end,
          totalCorrectAnswers: 0,
          totalWrongAnswers: 0,
          subjectCountsChat: {},
        });
      }

      for (
        let attemptIndex = 0;
        attemptIndex < ATTEMPT_COUNT_PER_STUDENT;
        attemptIndex++
      ) {
        const quiz =
          publishedQuizzes[(studentIndex + attemptIndex) % publishedQuizzes.length];
        const quizQuestions = questionsByQuiz.get(quiz.id);
        assertInvariant(quizQuestions, `perguntas ausentes no quiz ${quiz.id}`);

        const score = PROFILE_SCORES[profile][attemptIndex];
        const sessionIndex = ATTEMPT_SESSION_INDEXES[attemptIndex];
        const analyticsSession = sessionRowsForStudent[sessionIndex];
        const completedAt = addMinutes(
          analyticsSession.sessionStart as Date,
          5 + attemptIndex,
        );
        const professorAttemptId = deterministicUuid(
          "7",
          ++professorAttemptIndex,
        );
        const analyticsAttemptId = deterministicUuid(
          "9",
          ++analyticsAttemptIndex,
        );

        professorAttemptRows.push({
          id: professorAttemptId,
          quizId: quiz.id,
          studentId: student.id,
          score,
          totalQuestions: QUESTIONS_PER_QUIZ,
          completedAt,
        });
        analyticsAttemptRows.push({
          id: analyticsAttemptId,
          sessionId: analyticsSession.id as string,
          totalCorrectAnswers: score,
          totalWrongAnswers: QUESTIONS_PER_QUIZ - score,
          createdAt: completedAt,
        });

        analyticsSession.totalCorrectAnswers =
          Number(analyticsSession.totalCorrectAnswers || 0) + score;
        analyticsSession.totalWrongAnswers =
          Number(analyticsSession.totalWrongAnswers || 0) +
          (QUESTIONS_PER_QUIZ - score);
        subjectCountsQuiz[quiz.topic] =
          (subjectCountsQuiz[quiz.topic] || 0) + QUESTIONS_PER_QUIZ;

        quizQuestions.forEach((question, questionOffset) => {
          const isCorrect =
            (questionOffset + studentIndex + attemptIndex) %
              QUESTIONS_PER_QUIZ <
            score;
          const selectedOption = isCorrect
            ? question.correctOption
            : wrongOption(
                question.correctOption,
                studentIndex + attemptIndex + questionOffset,
              );

          professorAnswerRows.push({
            id: deterministicUuid("8", ++professorAnswerIndex),
            attemptId: professorAttemptId,
            questionId: question.id,
            selectedOption,
            isCorrect,
          });
          answerQuestionRows.push({
            id: deterministicUuid("a", ++answerQuestionIndex),
            attemptId: analyticsAttemptId,
            level: studentProfileRows[studentIndex].level,
            subject: quiz.topic,
            question: question.question,
            selectedOption,
            isCorrect,
            explanation: question.explanation,
            totalCorrectAnswers: isCorrect ? 1 : 0,
            totalWrongAnswers: isCorrect ? 0 : 1,
            timestamp: addMinutes(completedAt, questionOffset),
          });
        });
      }

      for (
        let chatIndex = 0;
        chatIndex < CHAT_COUNT_PER_STUDENT;
        chatIndex++
      ) {
        const sessionId = `seed2-aluno-${(studentIndex + 1)
          .toString()
          .padStart(2, "0")}-chat-${chatIndex + 1}`;
        const chatSessionId = deterministicUuid("b", ++chatSessionIndex);
        const relatedAnalyticsSession =
          sessionRowsForStudent[CHAT_SESSION_INDEXES[chatIndex]];
        const chatStart = addMinutes(
          relatedAnalyticsSession.sessionStart as Date,
          3,
        );
        const firstTopic = TOPICS[(studentIndex + chatIndex * 2) % TOPICS.length];
        const finalMessageAt = addMinutes(
          chatStart,
          CHAT_TURNS_PER_SESSION * 7,
        );

        chatSessionRows.push({
          id: chatSessionId,
          userId: student.id,
          sessionId,
          title: firstTopic.chatQuestions[chatIndex % firstTopic.chatQuestions.length],
          startedAt: chatStart,
          lastActivityAt: finalMessageAt,
        });

        for (let turn = 0; turn < CHAT_TURNS_PER_SESSION; turn++) {
          const topic =
            TOPICS[(studentIndex + chatIndex * 2 + turn) % TOPICS.length];
          const templateIndex = (studentIndex + chatIndex + turn) % 3;
          const userTimestamp = addMinutes(chatStart, turn * 7);
          const assistantTimestamp = addMinutes(userTimestamp, 2);

          chatMessageRows.push({
            id: deterministicUuid("c", ++chatMessageIndex),
            chatSessionId,
            role: "user",
            content: topic.chatQuestions[templateIndex],
            detectedTopic: topic.key,
            metadata: { seed: "seed2" },
            timestamp: userTimestamp,
          });
          chatMessageRows.push({
            id: deterministicUuid("c", ++chatMessageIndex),
            chatSessionId,
            role: "assistant",
            content: topic.chatAnswers[templateIndex],
            detectedTopic: topic.key,
            metadata: { seed: "seed2", provider: "demo" },
            timestamp: assistantTimestamp,
          });
          chatCounts[topic.key] = (chatCounts[topic.key] || 0) + 1;

          const analyticsSession = relatedAnalyticsSession;
          const sessionCounts = analyticsSession.subjectCountsChat as Record<
            string,
            number
          >;
          sessionCounts[topic.key] = (sessionCounts[topic.key] || 0) + 1;
        }
      }

      for (const [topic, topicCount] of Object.entries(chatCounts)) {
        chatTopicCountRows.push({
          userId: student.id,
          topic,
          count: topicCount,
        });
      }

      const totalCorrectAnswers = sessionRowsForStudent.reduce(
        (total, session) => total + Number(session.totalCorrectAnswers || 0),
        0,
      );
      const totalWrongAnswers = sessionRowsForStudent.reduce(
        (total, session) => total + Number(session.totalWrongAnswers || 0),
        0,
      );
      const totalUsageTime = sessionRowsForStudent.reduce(
        (total, session) => total + Number(session.sessionDuration || 0),
        0,
      );

      assertInvariant(
        totalCorrectAnswers + totalWrongAnswers ===
          ATTEMPT_COUNT_PER_STUDENT * QUESTIONS_PER_QUIZ,
        `totais de respostas inválidos para ${student.email}`,
      );
      assertInvariant(
        Object.values(chatCounts).reduce((total, value) => total + value, 0) ===
          CHAT_COUNT_PER_STUDENT * CHAT_TURNS_PER_SESSION,
        `contadores de chat inválidos para ${student.email}`,
      );

      userAnalysisRows.push({
        id: analysisId,
        userId: student.id,
        name: student.name,
        email: student.email,
        schoolId: SEED_IDS.university,
        schoolName: baseSeed.university.name,
        courseId: SEED_IDS.course,
        courseName: baseSeed.course.name,
        classId: SEED_IDS.classes[classIndex],
        className: baseSeed.classes[classIndex].name,
        totalUsageTime,
        totalCorrectAnswers,
        totalWrongAnswers,
        subjectCountsQuiz,
      });
      analyticsSessionRows.push(...sessionRowsForStudent);
    }

    const feedbackTypes = ["GERAL", "SUGESTAO", "BUG"] as const;
    const feedbackMessages = [
      "A visão de desempenho por assunto ajudou a organizar minha revisão.",
      "Seria útil receber uma recomendação automática depois de cada quiz.",
      "Em uma tentativa, precisei recarregar a página para ver o histórico.",
      "Os exemplos do tutor deixam o conteúdo mais fácil de acompanhar.",
      "Gostaria de poder favoritar explicações importantes do chat.",
      "O filtro de período poderia lembrar a última seleção utilizada.",
    ];
    for (let index = 0; index < 18; index++) {
      feedbackRows.push({
        id: deterministicUuid("d", index + 1),
        accountId: studentIds[index],
        type: feedbackTypes[index % feedbackTypes.length],
        message: feedbackMessages[index % feedbackMessages.length],
        createdAt: dateDaysAgo(baseDate, 1 + (index % 15), 14, index % 50),
      });
    }

    assertInvariant(
      userAnalysisRows.length === STUDENT_COUNT,
      "quantidade de análises de usuário",
    );
    assertInvariant(
      analyticsSessionRows.length ===
        STUDENT_COUNT * SESSION_COUNT_PER_STUDENT,
      "quantidade de sessões analíticas",
    );
    assertInvariant(
      professorAttemptRows.length === STUDENT_COUNT * ATTEMPT_COUNT_PER_STUDENT,
      "quantidade de tentativas de quiz",
    );
    assertInvariant(
      professorAnswerRows.length ===
        STUDENT_COUNT * ATTEMPT_COUNT_PER_STUDENT * QUESTIONS_PER_QUIZ,
      "quantidade de respostas de quiz",
    );
    assertInvariant(
      analyticsAttemptRows.length === professorAttemptRows.length,
      "espelhamento das tentativas analíticas",
    );
    assertInvariant(
      answerQuestionRows.length === professorAnswerRows.length,
      "espelhamento das respostas analíticas",
    );
    assertInvariant(
      chatSessionRows.length === STUDENT_COUNT * CHAT_COUNT_PER_STUDENT,
      "quantidade de conversas",
    );
    assertInvariant(
      chatMessageRows.length ===
        STUDENT_COUNT *
          CHAT_COUNT_PER_STUDENT *
          CHAT_TURNS_PER_SESSION *
          2,
      "quantidade de mensagens",
    );
    assertInvariant(feedbackRows.length === 18, "quantidade de feedbacks");

    await tx.insert(userAnalyses).values(userAnalysisRows);
    await tx.insert(analysisSessions).values(analyticsSessionRows);
    await tx.insert(answerAttempts).values(analyticsAttemptRows);
    await tx.insert(answerQuestions).values(answerQuestionRows);
    await tx.insert(professorQuizAttempts).values(professorAttemptRows);
    await tx.insert(professorQuizAnswers).values(professorAnswerRows);
    await tx.insert(chatSessions).values(chatSessionRows);
    await tx.insert(chatMessages).values(chatMessageRows);
    await tx.insert(chatTopicCounts).values(chatTopicCountRows);
    await tx.insert(feedbacks).values(feedbackRows);

    const countRows = async (
      table: Parameters<typeof tx.select>[0] extends never ? never : any,
      column: any,
      ids: string[],
    ) => {
      const [result] = await tx
        .select({ value: count() })
        .from(table)
        .where(inArray(column, ids));
      return Number(result.value);
    };

    const persistedCounts = {
      students: await countRows(accounts, accounts.id, studentIds),
      disciplines: await countRows(disciplines, disciplines.id, disciplineIds),
      quizzes: await countRows(professorQuizzes, professorQuizzes.id, quizIds),
      questions: await countRows(
        professorQuizQuestions,
        professorQuizQuestions.quizId,
        quizIds,
      ),
      analyses: await countRows(
        userAnalyses,
        userAnalyses.userId,
        studentIds,
      ),
      sessions: await countRows(
        analysisSessions,
        analysisSessions.id,
        analyticsSessionRows.map((row) => row.id as string),
      ),
      quizAttempts: await countRows(
        professorQuizAttempts,
        professorQuizAttempts.id,
        professorAttemptRows.map((row) => row.id as string),
      ),
      quizAnswers: await countRows(
        professorQuizAnswers,
        professorQuizAnswers.attemptId,
        professorAttemptRows.map((row) => row.id as string),
      ),
      analyticsAttempts: await countRows(
        answerAttempts,
        answerAttempts.id,
        analyticsAttemptRows.map((row) => row.id as string),
      ),
      analyticsAnswers: await countRows(
        answerQuestions,
        answerQuestions.attemptId,
        analyticsAttemptRows.map((row) => row.id as string),
      ),
      chats: await countRows(
        chatSessions,
        chatSessions.id,
        chatSessionRows.map((row) => row.id as string),
      ),
      messages: await countRows(
        chatMessages,
        chatMessages.chatSessionId,
        chatSessionRows.map((row) => row.id as string),
      ),
      feedbacks: await countRows(
        feedbacks,
        feedbacks.id,
        feedbackRows.map((row) => row.id as string),
      ),
    };

    const expectedCounts = {
      students: 36,
      disciplines: 5,
      quizzes: 10,
      questions: 50,
      analyses: 36,
      sessions: 288,
      quizAttempts: 216,
      quizAnswers: 1080,
      analyticsAttempts: 216,
      analyticsAnswers: 1080,
      chats: 108,
      messages: 648,
      feedbacks: 18,
    };

    for (const [key, expected] of Object.entries(expectedCounts)) {
      assertInvariant(
        persistedCounts[key as keyof typeof persistedCounts] === expected,
        `${key}: esperado ${expected}, persistido ${
          persistedCounts[key as keyof typeof persistedCounts]
        }`,
      );
    }

    const [publishedCount] = await tx
      .select({ value: count() })
      .from(professorQuizzes)
      .where(
        and(
          inArray(professorQuizzes.id, quizIds),
          eq(professorQuizzes.status, "published"),
        ),
      );
    assertInvariant(
      Number(publishedCount.value) === 8,
      "quantidade persistida de quizzes publicados",
    );

    return persistedCounts;
  });

  return {
    summary,
    showcaseAccounts: [0, STUDENTS_PER_CLASS, STUDENTS_PER_CLASS * 2].map(
      (index) => ({
        name: studentAccountRows[index].name,
        email: studentAccountRows[index].email,
        password: studentAccountRows[index].email,
        classId: SEED_IDS.classes[Math.floor(index / STUDENTS_PER_CLASS)],
      }),
    ),
  };
}

async function main() {
  try {
    const result = await seedDemoData();
    console.log("\nSuper seed concluído com sucesso.");
    console.table(result.summary);
    console.log("\nContas de destaque (senha igual ao e-mail):");
    console.table(result.showcaseAccounts);
  } catch (error) {
    console.error("\nFalha ao executar o db:seed2.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDatabasePool();
  }
}

void main();
