import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

interface LearningJourneyDTO {
  labels: string[];
  data: number[];
}

export class GetLearningJourneyService {
  public async execute(filters: IFilters): Promise<LearningJourneyDTO> {
    const query: any = {};
    if (filters.universityId) query.schoolId = new Types.ObjectId(filters.universityId);
    if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
    if (filters.classId) query.classId = new Types.ObjectId(filters.classId);
    if (filters.studentId) query.userId = filters.studentId;

    const allQuestions = await UserAnalysis.aggregate([
      { $match: query },
      { $unwind: "$sessions" },
      { $unwind: "$sessions.answerHistory" },
      { $unwind: "$sessions.answerHistory.questions" },
      { $replaceRoot: { newRoot: "$sessions.answerHistory.questions" } },
      { $sort: { timestamp: 1 } },
      { $project: { isCorrect: "$selectedOption.isCorrect" } }
    ]);

    if (allQuestions.length === 0) {
      return { labels: [], data: [] };
    }

    const numBlocks = allQuestions.length < 20 ? Math.max(1, Math.floor(allQuestions.length / 4)) : 5;
    const blockSize = Math.ceil(allQuestions.length / numBlocks);
    const journeyData: number[] = [];
    const journeyLabels: string[] = [];

    for (let i = 0; i < allQuestions.length; i += blockSize) {
      const block = allQuestions.slice(i, i + blockSize);
      if (block.length === 0) continue;

      const correctAnswers = block.filter(q => q.isCorrect).length;
      const successRate = (correctAnswers / block.length) * 100;

      journeyData.push(parseFloat(successRate.toFixed(1)));
      const start = i + 1;
      const end = i + block.length;
      journeyLabels.push(start === end ? `Questão ${start}` : `Questões ${start}-${end}`);
    }

    return { labels: journeyLabels, data: journeyData };
  }
}