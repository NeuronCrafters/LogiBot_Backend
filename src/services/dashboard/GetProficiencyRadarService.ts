import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

interface ProficiencyRadarDTO {
  labels: string[];
  data: number[];
}

export class GetProficiencyRadarService {
  public async execute(filters: IFilters): Promise<ProficiencyRadarDTO> {
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
      { $sort: { _id: 1 } }
    ]);

    const labels: string[] = [];
    const data: number[] = [];

    aggregationResult.forEach(item => {
      const total = item.totalCorrect + item.totalWrong;
      const successRate = total > 0 ? (item.totalCorrect / total) * 100 : 0;
      labels.push(item._id);
      data.push(parseFloat(successRate.toFixed(1)));
    });

    return { labels, data };
  }
}