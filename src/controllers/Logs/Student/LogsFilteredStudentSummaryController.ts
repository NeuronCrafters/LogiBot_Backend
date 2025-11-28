import { Request, Response } from "express";
import { LogsFilteredStudentSummaryService } from "../../../services/Logs/Student/LogsFilteredStudentSummaryService";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Professor } from "../../../models/Professor";
import { Discipline } from "../../../models/Discipline";
import { Types } from "mongoose";
import { isAdmin, isCourseCoordinator, isProfessor } from "../../../utils/RoleChecker";

export async function LogsFilteredStudentSummaryController(req: Request, res: Response) {
  try {
    const { universityId, courseId, classId, studentId } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    console.log("[logsfilteredstudentsummarycontroller] requisição recebida:", {
      universityId,
      courseId,
      classId,
      studentId,
      userId,
      userRole,
      userEmail: req.user.email
    });

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    if (isAdmin(userRole)) {
      const summary = await LogsFilteredStudentSummaryService(universityId, courseId, classId, studentId);
      return res.status(200).json(summary);
    }

    const professor = await Professor.findById(userId).populate('courses disciplines');

    if (!professor) {



      const professorByEmail = await Professor.findOne({ email: req.user.email }).populate('courses disciplines');

      if (!professorByEmail) {
        return res.status(403).json({ message: "Professor não encontrado." });
      }


    }

    const professorData = professor || (await Professor.findOne({ email: req.user.email }).populate('courses disciplines'));

    console.log("[logsfilteredstudentsummarycontroller] professor encontrado:", {
      id: professorData._id,
      name: professorData.name,
      email: professorData.email,
      courses: professorData.courses.map(c => c._id),
      disciplines: professorData.disciplines.map(d => d._id)
    });

    const courseObjectId = courseId ? new Types.ObjectId(courseId) : null;
    const classObjectId = classId ? new Types.ObjectId(classId) : null;

    if (isCourseCoordinator(userRole) && courseObjectId) {
      if (professorData.courses.some(c => c.equals(courseObjectId))) {
        const summary = await LogsFilteredStudentSummaryService(universityId, courseId, classId, studentId);
        return res.status(200).json(summary);
      }

    }

    if (isProfessor(userRole) && courseId && classId) {
      const disciplinas = await Discipline.find({
        _id: { $in: professorData.disciplines },
        classes: classId
      });



      if (disciplinas.length === 0) {
        return res.status(403).json({ message: "Acesso negado. Professor não leciona nesta turma." });
      }

      if (studentId) {
        const aluno = await UserAnalysis.findOne({
          userId: studentId,
          schoolId: universityId,
          courseId,
          classId
        });

        if (!aluno) {

          return res.status(404).json({ message: "Aluno não encontrado nesta turma." });
        }

        console.log("[logsfilteredstudentsummarycontroller] aluno encontrado:", {
          userId: aluno.userId,
          name: aluno.name,
          email: aluno.email
        });
      }

      const summary = await LogsFilteredStudentSummaryService(universityId, courseId, classId, studentId);

      return res.status(200).json(summary);
    }

    return res.status(403).json({ message: "Acesso negado. Permissões insuficientes." });
  } catch (error) {

    return res.status(500).json({ message: "Erro ao obter dados filtrados do aluno." });
  }
}