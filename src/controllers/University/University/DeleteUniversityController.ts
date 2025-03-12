import { Request, Response } from "express";
import { DeleteUniversityService } from "../../../services/University/University/DeleteUniversityService";

class DeleteUniversityController {
  async handle(req: Request, res: Response) {
    try {
      const { universityId } = req.params;
      if (!universityId) {
        return res.status(400).json({ message: "ID da universidade é obrigatório!" });
      }

      const deleteUniversityService = new DeleteUniversityService();
      const result = await deleteUniversityService.execute(universityId);

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { DeleteUniversityController };
