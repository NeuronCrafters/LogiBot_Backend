import { Discipline } from "../../../models/Discipline";
import { Course } from "../../../models/Course";
import { Class } from "../../../models/Class";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class CreateDisciplineService {
  async execute(name: string, courseId: string, classIds: string[], professorIds: string[]) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new AppError("ID do curso inválido!", 400);
    }
    const courseObjectId = new Types.ObjectId(courseId);

    const course = await Course.findById(courseObjectId);
    if (!course) {
      throw new AppError("Curso não encontrado!", 404);
    }

    if (!Array.isArray(classIds) || classIds.some(id => !Types.ObjectId.isValid(id))) {
      throw new AppError("IDs de turma inválidos!", 400);
    }
    const classObjectIds = classIds.map(id => new Types.ObjectId(id));

    const classes = await Class.find({ _id: { $in: classObjectIds } });
    if (classes.length !== classIds.length) {
      throw new AppError("Uma ou mais turmas não foram encontradas!", 404);
    }

    if (!Array.isArray(professorIds)) {
      throw new AppError("IDs de professor inválidos!", 400);
    }
    const professorObjectIds = professorIds.map(id => new Types.ObjectId(id));

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
}

export { CreateDisciplineService };
