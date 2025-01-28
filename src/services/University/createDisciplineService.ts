import { Discipline } from "../../models/Discipline";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Professor } from "../../models/Professor";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";

class createDisciplineService {
  async create(name: string, courseId: string, classIds: string[], professorIds: string[]) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new AppError("ID do curso inválido!", 400);
    }
    const courseObjectId = new Types.ObjectId(courseId);

    const course = await Course.findById(courseObjectId);
    if (!course) {
      throw new AppError("Curso não encontrado!", 404);
    }

    if (!Array.isArray(classIds)) {
      throw new AppError("classIds deve ser um array!", 400);
    }
    const invalidClassIds = classIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidClassIds.length > 0) {
      throw new AppError(`IDs de turma inválidos: ${invalidClassIds.join(", ")}`, 400);
    }
    const classObjectIds = classIds.map((id) => new Types.ObjectId(id));

    const classes = await Class.find({ _id: { $in: classObjectIds } });
    if (classes.length !== classIds.length) {
      throw new AppError("Uma ou mais turmas não foram encontradas!", 404);
    }

    if (!Array.isArray(professorIds)) {
      throw new AppError("professorIds deve ser um array!", 400);
    }
    const invalidProfessorIds = professorIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidProfessorIds.length > 0) {
      throw new AppError(`IDs de professor inválidos: ${invalidProfessorIds.join(", ")}`, 400);
    }
    const professorObjectIds = professorIds.map((id) => new Types.ObjectId(id));

    const existingDiscipline = await Discipline.findOne({ name, course: courseObjectId });
    if (existingDiscipline) {
      throw new AppError("Disciplina já existe para este curso!", 409);
    }

    const discipline = await Discipline.create({
      name,
      course: courseObjectId,
      classes: classObjectIds,
      professors: professorObjectIds,
    });

    course.disciplines.push(discipline._id as Types.ObjectId);
    await course.save();

    await Class.updateMany(
      { _id: { $in: classObjectIds } },
      { $addToSet: { disciplines: discipline._id } }
    );

    await Professor.updateMany(
      { _id: { $in: professorObjectIds } },
      { $addToSet: { disciplines: discipline._id } }
    );

    return discipline;
  }

  async list() {
    const disciplines = await Discipline.find()
      .populate("course", "name")
      .populate("classes", "name")
      .populate("professors", "name");
    return disciplines;
  }

  async delete(disciplineId: string) {
    if (!Types.ObjectId.isValid(disciplineId)) {
      throw new AppError("ID da disciplina inválido!", 400);
    }

    const discipline = await Discipline.findById(disciplineId);
    if (!discipline) {
      throw new AppError("Disciplina não encontrada!", 404);
    }

    await Discipline.findOneAndDelete({ _id: disciplineId });

    return { message: "Disciplina excluída com sucesso!" };
  }
}

export { createDisciplineService };
