import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

// 🔧 Adicione esta função AQUI, antes da classe
function extractMainSubject(subject: string): string {
  const mainSubjects = ['variaveis', 'tipos', 'funcoes', 'loops', 'verificacoes', 'listas'];
  const mainPart = subject.split('_')[0];

  if (mainSubjects.includes(mainPart)) {
    return capitalize(mainPart); // Ex: "variaveis" => "Variaveis"
  }

  return 'Outros'; // Caso não pertença às categorias conhecidas
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 🚨 Se estiver usando esse import, pode REMOVER isso
// import { subcategoryToCategoryMap } from '../../utils/quizUtils';

interface ProficiencyRadarDTO {
  labels: string[];
  data: number[];
}

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

export class GetProficiencyRadarService {
  public async execute(filters: IFilters): Promise<ProficiencyRadarDTO> {
    const query: any = {};
    if (filters.universityId) query.schoolId = new Types.ObjectId(filters.universityId);
    if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
    if (filters.classId) query.classId = new Types.ObjectId(filters.classId);
    if (filters.studentId) query.userId = filters.studentId;

    const usersAnalysis = await UserAnalysis.find(query).select('performanceBySubject').lean();

    const performanceByCategory: Record<string, { correct: number; wrong: number }> = {};

    for (const user of usersAnalysis) {
      if (!user.performanceBySubject) continue;

      for (const subtopic in user.performanceBySubject) {
        if (Object.prototype.hasOwnProperty.call(user.performanceBySubject, subtopic)) {
          const mainCategory = extractMainSubject(subtopic); // <-- ALTERADO AQUI

          if (!performanceByCategory[mainCategory]) {
            performanceByCategory[mainCategory] = { correct: 0, wrong: 0 };
          }

          const performance = user.performanceBySubject[subtopic];
          performanceByCategory[mainCategory].correct += performance.correct || 0;
          performanceByCategory[mainCategory].wrong += performance.wrong || 0;
        }
      }
    }

    const sortedCategories = Object.keys(performanceByCategory).sort();

    const labels: string[] = [];
    const data: number[] = [];

    sortedCategories.forEach(category => {
      const totals = performanceByCategory[category];
      const totalAnswers = totals.correct + totals.wrong;
      const successRate = totalAnswers > 0 ? (totals.correct / totalAnswers) * 100 : 0;

      labels.push(category);
      data.push(parseFloat(successRate.toFixed(1)));
    });

    return { labels, data };
  }
}
