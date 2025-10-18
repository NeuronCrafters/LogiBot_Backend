import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

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

    const aggregationResult = await UserAnalysis.aggregate([
      { $match: query },
      { $project: { subjects: { $objectToArray: "$performanceBySubject" } } },
      { $unwind: "$subjects" },
      {
        $group: {
          _id: "$subjects.k",
          totalCorrect: { $sum: "$subjects.v.correct" },
          totalWrong: { $sum: "$subjects.v.wrong" },
        }
      },
      {
        $project: {
          _id: 0,
          topic: "$_id",
          totalCorrect: "$totalCorrect",
          totalWrong: "$totalWrong"
        }
      }
    ]);

    const formattedData = aggregationResult.map(item => {
      const total = item.totalCorrect + item.totalWrong;
      if (total === 0) {
        return { topic: item.topic, successPercentage: 0, errorPercentage: 0 };
      }
      return {
        topic: item.topic,
        successPercentage: parseFloat(((item.totalCorrect / total) * 100).toFixed(1)),
        errorPercentage: parseFloat(((item.totalWrong / total) * 100).toFixed(1)),
      };
    });

    return formattedData.sort((a, b) => a.successPercentage - b.successPercentage);
  }
}