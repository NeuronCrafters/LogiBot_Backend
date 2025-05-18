import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { University } from "../../../../models/University";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityAccuracyService(universityId: string) {
  try {
    const university = await University.findById(universityId);
    if (!university) {
      throw new AppError("Universidade não encontrada", 404);
    }

    const users = await User.find({ school: universityId });
    if (!users.length) {
      throw new AppError("Nenhum aluno encontrado para esta universidade", 404);
    }

    const userIds = users.map(u => u._id.toString());
    const logs = await UserAnalysis.find({ userId: { $in: userIds } });

    const totalCorrect = logs.reduce((acc, curr) => acc + (curr.totalCorrectAnswers || 0), 0);
    const totalWrong = logs.reduce((acc, curr) => acc + (curr.totalWrongAnswers || 0), 0);
    const totalQuestions = totalCorrect + totalWrong;

    const studentCount = logs.length;
    const averageCorrectPerStudent = studentCount > 0 ? totalCorrect / studentCount : 0;
    const averageWrongPerStudent = studentCount > 0 ? totalWrong / studentCount : 0;

    return {
      universityName: university.name,
      totalCorrect,
      totalWrong,
      accuracyRate: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
      studentCount,
      averageCorrectPerStudent,
      averageWrongPerStudent
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Erro ao buscar acertos e erros da universidade", 500);
  }
}