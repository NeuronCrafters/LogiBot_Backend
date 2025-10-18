import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

type AccessPatternDTO = [number, number, number][];

export class GetAccessPatternService {
  public async execute(filters: IFilters): Promise<AccessPatternDTO> {
    const query: any = {};
    if (filters.universityId) query.schoolId = new Types.ObjectId(filters.universityId);
    if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
    if (filters.classId) query.classId = new Types.ObjectId(filters.classId);
    if (filters.studentId) query.userId = filters.studentId;

    const aggregationResult = await UserAnalysis.aggregate([
      { $match: query },
      { $unwind: "$sessions" },
      { $match: { "sessions.sessionStart": { $ne: null } } },
      { $project: { sessionStart: "$sessions.sessionStart" } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: { date: "$sessionStart", timezone: "America/Sao_Paulo" } },
            hour: { $hour: { date: "$sessionStart", timezone: "America/Sao_Paulo" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          day: { $subtract: ["$_id.dayOfWeek", 1] },
          hour: "$_id.hour",
          value: "$count"
        }
      }
    ]);

    return aggregationResult.map(item => [item.day, item.hour, item.value]);
  }
}