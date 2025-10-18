import { UserAnalysis } from '../../models/UserAnalysis';
import { Types } from 'mongoose';

interface IFilters {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
}

interface EffortMatrixDTO {
  points: {
    name: string;
    performance: number;
    effort: number;
    isAverage?: boolean;
  }[];
  averages: {
    avgPerformance: number;
    avgEffort: number;
  };
}

export class GetEffortMatrixService {
  public async execute(filters: IFilters): Promise<EffortMatrixDTO> {
    if (filters.studentId && filters.classId) {
      return this.getSingleStudentMatrix(filters.studentId, filters.classId);
    }

    const query: any = {};
    if (filters.universityId) query.schoolId = new Types.ObjectId(filters.universityId);
    if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
    if (filters.classId) query.classId = new Types.ObjectId(filters.classId);

    const users = await UserAnalysis.find(query).select('name className totalUsageTime totalCorrectWrongAnswers');
    return this.calculateMatrix(users);
  }

  private async getSingleStudentMatrix(studentId: string, classId: string): Promise<EffortMatrixDTO> {
    const student = await UserAnalysis.findOne({ userId: studentId, classId: new Types.ObjectId(classId) });
    if (!student) {
      return { points: [], averages: { avgPerformance: 0, avgEffort: 0 } };
    }

    const classUsers = await UserAnalysis.find({ classId: new Types.ObjectId(classId) }).select('totalUsageTime totalCorrectWrongAnswers');
    const classMatrix = this.calculateMatrix(classUsers);
    const studentPoint = this.formatUserToPoint(student, student.name);
    const classAveragePoint = {
      name: `Média da Turma (${student.className})`,
      performance: classMatrix.averages.avgPerformance,
      effort: classMatrix.averages.avgEffort,
      isAverage: true
    };

    return {
      points: [studentPoint, classAveragePoint],
      averages: classMatrix.averages
    };
  }

  private calculateMatrix(users: any[]): EffortMatrixDTO {
    if (users.length === 0) {
      return { points: [], averages: { avgPerformance: 0, avgEffort: 0 } };
    }

    let totalPerformanceSum = 0;
    let totalEffortSum = 0;

    const points = users.map(user => {
      const point = this.formatUserToPoint(user);
      totalPerformanceSum += point.performance;
      totalEffortSum += point.effort;
      return point;
    });

    // Refinamento: Cálculo das médias com proteção explícita contra divisão por zero.
    const avgPerformance = users.length > 0 ? totalPerformanceSum / users.length : 0;
    const avgEffort = users.length > 0 ? totalEffortSum / users.length : 0;

    const averages = {
      avgPerformance: parseFloat(avgPerformance.toFixed(1)),
      avgEffort: parseFloat(avgEffort.toFixed(1)),
    };

    return { points, averages };
  }

  private formatUserToPoint(user: any, name?: string) {
    // Garante que os valores sejam numéricos, usando `|| 0` como fallback.
    const totalCorrectAnswers = user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    const totalWrongAnswers = user.totalCorrectWrongAnswers?.totalWrongAnswers || 0;

    const totalAnswers = totalCorrectAnswers + totalWrongAnswers;

    // Ponto crucial da correção: evita a divisão 0/0 que resulta em NaN.
    const performance = totalAnswers > 0 ? (totalCorrectAnswers / totalAnswers) * 100 : 0;
    const effortInMinutes = (user.totalUsageTime || 0) / 60;

    return {
      name: name || user.name,
      performance: parseFloat(performance.toFixed(1)),
      effort: parseFloat(effortInMinutes.toFixed(1)),
    };
  }
}