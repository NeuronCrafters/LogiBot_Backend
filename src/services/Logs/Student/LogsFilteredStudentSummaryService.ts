import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsFilteredStudentSummaryService(
  universityId: string,
  courseId?: string,
  classId?: string,
  studentId?: string
) {
  const query: any = { schoolId: universityId };

  // Adiciona filtros opcionais
  if (courseId) query.courseId = courseId;
  if (classId) query.classId = classId;
  if (studentId) query.userId = studentId;

  console.log("Query para UserAnalysis:", query);

  const users = await UserAnalysis.find(query);

  console.log(`Encontrados ${users.length} registros de análise de usuários`);

  // Verifica se não encontrou nenhum usuário
  if (users.length === 0) {
    return {
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      usageTimeInSeconds: 0,
      usageTime: {
        formatted: "00:00:00",
        humanized: "0s",
        hours: 0,
        minutes: 0,
        seconds: 0
      },
      mostAccessedSubjects: {},
      userCount: 0,
      subjectCounts: {}
    };
  }

  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const subjectFrequency: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};

  users.forEach((ua) => {
    // Soma total de acertos/erros
    totalCorrectAnswers += ua.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    totalWrongAnswers += ua.totalCorrectWrongAnswers?.totalWrongAnswers || 0;
    totalUsageTime += ua.totalUsageTime || 0;

    // Processa subjectCounts (dados acumulados de todos os assuntos)
    if (ua.subjectCounts && typeof ua.subjectCounts === 'object') {
      for (const subject in ua.subjectCounts) {
        const count = ua.subjectCounts[subject];
        subjectCounts[subject] = (subjectCounts[subject] || 0) +
          (typeof count === 'number' ? count : 0);
      }
    }

    // Verifica se sessions existe e é um array
    if (ua.sessions && Array.isArray(ua.sessions)) {
      ua.sessions.forEach((session) => {
        // Verifica se subjectFrequency é um objeto
        if (session.subjectFrequency && typeof session.subjectFrequency === 'object') {
          // Iterar sobre as propriedades do objeto
          for (const subject in session.subjectFrequency) {
            const count = session.subjectFrequency[subject];
            subjectFrequency[subject] = (subjectFrequency[subject] || 0) +
              (typeof count === 'number' ? count : 0);
          }
        }
      });
    }
  });

  // Formatar tempo de uso
  const usageTimeObj = calculateUsageTime(totalUsageTime);

  // Formatar mostAccessedSubjects como um objeto para facilitar o uso no frontend
  const formattedSubjects: Record<string, number> = {};
  Object.entries(subjectFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([subject, count]) => {
      formattedSubjects[subject] = count;
    });

  let result: any = {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,  // Mantém o valor original em segundos
    usageTime: usageTimeObj,  // Adiciona objeto com formatos humanizados
    mostAccessedSubjects: formattedSubjects,
    userCount: users.length,
    subjectCounts
  };

  // Se estiver buscando um estudante específico, inclui os dados detalhados
  if (studentId && users.length > 0) {
    const userUsageTime = calculateUsageTime(users[0].totalUsageTime || 0);

    result.users = {
      // Inclui apenas os campos necessários do primeiro usuário encontrado
      _id: users[0]._id,
      userId: users[0].userId,
      name: users[0].name,
      email: users[0].email,
      schoolId: users[0].schoolId,
      schoolName: users[0].schoolName,
      courseId: users[0].courseId,
      courseName: users[0].courseName,
      classId: users[0].classId,
      className: users[0].className,
      totalUsageTime: users[0].totalUsageTime,
      usageTime: userUsageTime,  // Adiciona formatação de tempo para o usuário específico
      totalCorrectWrongAnswers: users[0].totalCorrectWrongAnswers,
      subjectCounts: users[0].subjectCounts || {}
    };
  }

  return result;
}