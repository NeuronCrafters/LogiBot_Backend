import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

type SessionDetailsDTO = {
  startTime: string;
  endTime: string;
}[];

export class GetSessionDetailsService {
  public async execute(filters: IFilters): Promise<SessionDetailsDTO> {
    const query: any = {};
    if (filters.universityId) query.schoolId = new Types.ObjectId(filters.universityId);
    if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
    if (filters.classId) query.classId = new Types.ObjectId(filters.classId);
    if (filters.studentId) query.userId = filters.studentId;

    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);

      endDate.setUTCHours(23, 59, 59, 999);

      query['sessions.sessionStart'] = {
        $gte: startDate,
        $lte: endDate,
      };
    }


    const aggregationResult = await UserAnalysis.aggregate([
      { $match: query },

      { $unwind: "$sessions" },

      {
        $match: {
          "sessions.sessionEnd": { $exists: true, $ne: null },
          ...(filters.startDate && filters.endDate && {
            "sessions.sessionStart": {
              $gte: new Date(filters.startDate),
              $lte: new Date(new Date(filters.endDate).setUTCHours(23, 59, 59, 999))
            }
          })
        }
      },

      {
        $project: {
          _id: 0,
          startTime: "$sessions.sessionStart",
          endTime: "$sessions.sessionEnd"
        }
      }
    ]);

    return aggregationResult;
  }
}