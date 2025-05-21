import { UserAnalysis } from "../../../models/UserAnalysis";
import { calculateUsageTime } from "../../../utils/TimeFormatter";

export async function LogsStudentsComparisonService(
  studentId1: string,
  studentId2: string,
  classId: string
) {
  console.log("Comparando alunos:", studentId1, studentId2, "da turma:", classId);

  // Busca dados dos dois alunos
  const student1Data = await fetchStudentData(studentId1, classId);
  const student2Data = await fetchStudentData(studentId2, classId);

  if (!student1Data || !student2Data) {
    throw new Error("Um ou ambos os alunos não foram encontrados na turma especificada.");
  }

  return {
    student1: student1Data,
    student2: student2Data
  };
}

async function fetchStudentData(studentId: string, classId: string) {
  const user = await UserAnalysis.findOne({
    userId: studentId,
    classId: classId
  });

  console.log(`Análise do aluno ${studentId} na turma ${classId}:`, !!user);

  if (!user) {
    return null;
  }

  const usageTimeObj = calculateUsageTime(user.totalUsageTime || 0);

  // Filtrar apenas os assuntos desejados
  const subjectCountsQuiz = {
    variaveis: user.subjectCountsQuiz?.variaveis || 0,
    tipos: user.subjectCountsQuiz?.tipos || 0,
    funcoes: user.subjectCountsQuiz?.funcoes || 0,
    loops: user.subjectCountsQuiz?.loops || 0,
    verificacoes: user.subjectCountsQuiz?.verificacoes || 0
  };

  return {
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    totalCorrectAnswers: user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0,
    totalWrongAnswers: user.totalCorrectWrongAnswers?.totalWrongAnswers || 0,
    usageTimeInSeconds: user.totalUsageTime || 0,
    usageTime: usageTimeObj,
    subjectCountsQuiz
  };
}