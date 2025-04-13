import { Request, Response } from "express";
import { LogCourseService } from "../../services/Logs/LogCourseService";

class LogCourseController {
  private courseLogService = new LogCourseService();

  async getCourseLogs(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const { startDate, endDate } = req.query;
      const result = await this.courseLogService.getCourseLogs(
        req.user,
        courseId,
        startDate as string,
        endDate as string
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }
}

export { LogCourseController };
