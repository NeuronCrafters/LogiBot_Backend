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
    originalPerformance?: number;
    originalEffort?: number;
    isAverage?: boolean;
  }[];
  averages: {
    avgPerformance: number;
    avgEffort: number;
  };
}

const MAX_JITTER_EFFORT = 0.05;
const MAX_JITTER_PERFORMANCE = 0.5;

function applyJitter(value: number, maxJitter: number): number {
  const randomNoise = Math.random() * maxJitter * 2 - maxJitter;
  return value + randomNoise;
}

export class GetEffortMatrixService {
  public async execute(filters: IFilters): Promise<EffortMatrixDTO> {
    if (filters.studentId && filters.classId) {
      return this.getSingleStudentMatrix(filters.studentId, filters.classId, filters);
    }

    const query: any = {};
    if (filters.universityId) query.schoolId = new Types.ObjectId(filters.universityId);
    if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
    if (filters.classId) query.classId = new Types.ObjectId(filters.classId);

    const users = await UserAnalysis.find(query).select('name className totalUsageTime totalCorrectWrongAnswers');

    return this.calculateMatrixForMultipleUsers(users, filters);
  }

  private async getSingleStudentMatrix(studentId: string, classId: string, filters: IFilters): Promise<EffortMatrixDTO> {
    const student = await UserAnalysis.findOne({ userId: studentId, classId: new Types.ObjectId(classId) });
    if (!student) {
      return { points: [], averages: { avgPerformance: 0, avgEffort: 0 } };
    }

    const classUsers = await UserAnalysis.find({ classId: new Types.ObjectId(classId) }).select('totalUsageTime totalCorrectWrongAnswers');
    const classMatrix = this.calculateMatrixBase(classUsers);

    const originalStudentPoint = this.formatUserToPoint(student, student.name);
    const studentPoint = {
      ...originalStudentPoint,
      effort: parseFloat(applyJitter(originalStudentPoint.effort, MAX_JITTER_EFFORT).toFixed(1)),
      performance: parseFloat(applyJitter(originalStudentPoint.performance, MAX_JITTER_PERFORMANCE).toFixed(1)),
      originalEffort: originalStudentPoint.effort,
      originalPerformance: originalStudentPoint.performance,
    };

    const averageName = filters.classId ? `Média da Turma (${student.className})` : "Média do Grupo";

    const classAveragePoint = {
      name: averageName,
      performance: classMatrix.averages.avgPerformance,
      effort: classMatrix.averages.avgEffort,
      originalEffort: classMatrix.averages.avgEffort,
      originalPerformance: classMatrix.averages.avgPerformance,
      isAverage: true
    };

    return {
      points: [studentPoint, classAveragePoint],
      averages: classMatrix.averages
    };
  }

  private calculateMatrixForMultipleUsers(users: any[], filters: IFilters): EffortMatrixDTO {
    const matrix = this.calculateMatrixBase(users);

    if (users.length === 0) {
      return matrix;
    }

    let averageName = "Média do Grupo";
    if (filters.classId) {
      averageName = "Média da Turma";
    } else if (filters.courseId) {
      averageName = "Média do Curso";
    } else if (filters.universityId) {
      averageName = "Média da Universidade";
    }

    const groupAveragePoint = {
      name: averageName,
      performance: matrix.averages.avgPerformance,
      effort: matrix.averages.avgEffort,
      originalEffort: matrix.averages.avgEffort,
      originalPerformance: matrix.averages.avgPerformance,
      isAverage: true
    };

    matrix.points.push(groupAveragePoint);

    return matrix;
  }

  private calculateMatrixBase(users: any[]): EffortMatrixDTO {
    if (users.length === 0) {
      return { points: [], averages: { avgPerformance: 0, avgEffort: 0 } };
    }

    let totalPerformanceSum = 0;
    let totalEffortSum = 0;

    const points = users.map(user => {
      const originalPoint = this.formatUserToPoint(user);

      const jittteredPoint = {
        ...originalPoint,
        effort: parseFloat(applyJitter(originalPoint.effort, MAX_JITTER_EFFORT).toFixed(1)),
        performance: parseFloat(applyJitter(originalPoint.performance, MAX_JITTER_PERFORMANCE).toFixed(1)),
        originalEffort: originalPoint.effort,
        originalPerformance: originalPoint.performance,
      };

      totalPerformanceSum += originalPoint.performance;
      totalEffortSum += originalPoint.effort;

      return jittteredPoint;
    });

    const avgPerformance = users.length > 0 ? totalPerformanceSum / users.length : 0;
    const avgEffort = users.length > 0 ? totalEffortSum / users.length : 0;

    const averages = {
      avgPerformance: parseFloat(avgPerformance.toFixed(1)),
      avgEffort: parseFloat(avgEffort.toFixed(1)),
    };

    return { points, averages };
  }

  private formatUserToPoint(user: any, name?: string) {
    const totalCorrectAnswers = user.totalCorrectWrongAnswers?.totalCorrectAnswers || 0;
    const totalWrongAnswers = user.totalCorrectWrongAnswers?.totalWrongAnswers || 0;

    const totalAnswers = totalCorrectAnswers + totalWrongAnswers;

    const performance = totalAnswers > 0 ? (totalCorrectAnswers / totalAnswers) * 100 : 0;
    const effortInMinutes = (user.totalUsageTime || 0) / 60;

    return {
      name: name || user.name,
      performance: parseFloat(performance.toFixed(1)),
      effort: parseFloat(effortInMinutes.toFixed(1)),
    };
  }
}