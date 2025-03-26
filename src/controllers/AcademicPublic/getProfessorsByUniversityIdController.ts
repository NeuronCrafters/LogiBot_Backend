import { Request, Response } from "express";
import { getProfessorsByUniversityIdService } from "../../services/AcademicPublic/getProfessorsByUniversityIdService";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Professor } from "../../models/Professor";

export async function getProfessorsByUniversityIdController(req: Request, res: Response) {
  const { universityId, courseId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    let query = { school: universityId } as any;

    if (courseId) {
      const course = await Course.findOne({ _id: courseId, university: universityId });

      if (!course) {
        return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
      }

      query.courses = courseId;
    }

    const professors = await Professor.find(query).lean();

    res.status(200).json(professors);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar professores", error });
  }
}
