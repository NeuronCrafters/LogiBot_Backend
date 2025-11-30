import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';
import { subcategoryToCategoryMap } from '../../utils/quizUtils';

interface TopicPerformanceDTO {
  topic: string;
  successPercentage: number;
  errorPercentage: number;
}

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

export class GetTopicPerformanceService {
  public async execute(filters: IFilters): Promise<TopicPerformanceDTO[]> {
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
          const mainCategory = subcategoryToCategoryMap[subtopic];

          if (mainCategory) {
            if (!performanceByCategory[mainCategory]) {
              performanceByCategory[mainCategory] = { correct: 0, wrong: 0 };
            }
            const performance = user.performanceBySubject[subtopic];
            performanceByCategory[mainCategory].correct += performance.correct || 0;
            performanceByCategory[mainCategory].wrong += performance.wrong || 0;
          }
        }
      }
    }

    const formattedData: TopicPerformanceDTO[] = Object.entries(performanceByCategory).map(([topic, totals]) => {
      const totalAnswers = totals.correct + totals.wrong;
      if (totalAnswers === 0) {
        return { topic, successPercentage: 0, errorPercentage: 0 };
      }
      return {
        topic,
        successPercentage: parseFloat(((totals.correct / totalAnswers) * 100).toFixed(1)),
        errorPercentage: parseFloat(((totals.wrong / totalAnswers) * 100).toFixed(1)),
      };
    });

    return formattedData.sort((a, b) => a.successPercentage - b.successPercentage);
  }
}