import { Request, Response } from "express";
import { getStudentsByClassIdService } from "../../services/AcademicPublic/getStudentsByClassIdService";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { User } from "../../models/User";

export async function getStudentsByClassIdController(req: Request, res: Response) {
  const { universityId, courseId, classId } = req.params;

  try {
    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada" });
    }

    const course = await Course.findOne({ _id: courseId, university: universityId });
    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado para essa universidade" });
    }

    const classDoc = await Class.findOne({ _id: classId, course: courseId });
    if (!classDoc) {
      return res.status(404).json({ message: "Turma não encontrada para esse curso" });
    }

    const students = await User.find(
      { class: classId, role: "student" },
      { name: 1, email: 1, status: 1, photo: 1 }
    ).lean();

    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar alunos", error });
  }
}