import { Discipline } from "../../../models/Discipline";
import { Course } from "../../../models/Course";
import { Class } from "../../../models/Class";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "@/types/UuidCompat";
import { generateDisciplineCode } from "../../../config/generateCode";

class CreateDisciplineService {
  async execute(name: string, courseId: string, classIds: string[], professorIds: string[]) {
    if (!Types.Uuid.isValid(courseId)) {
      throw new AppError("id do curso inválido!", 400);
    }
    const courseUuid = new Types.Uuid(courseId);

    const course = await Course.findById(courseUuid).populate("university");
    if (!course) {
      throw new AppError("curso não encontrado!", 404);
    }

    if (!Array.isArray(classIds) || classIds.some(id => !Types.Uuid.isValid(id))) {
      throw new AppError("ids de turma inválidos!", 400);
    }
    const classUuids = classIds.map(id => new Types.Uuid(id));

    const classes = await Class.find({ _id: { $in: classUuids } });
    if (classes.length !== classIds.length) {
      throw new AppError("uma ou mais turmas não foram encontradas!", 404);
    }

    if (!Array.isArray(professorIds) || professorIds.some(id => !Types.Uuid.isValid(id))) {
      throw new AppError("ids de professor inválidos!", 400);
    }
    const professorUuids = professorIds.map(id => new Types.Uuid(id));

    const existingDiscipline = await Discipline.findOne({ name, course: courseUuid });
    if (existingDiscipline) {
      throw new AppError("disciplina já existe para este curso!", 409);
    }

    const discipline = await Discipline.create({
      name,
      course: courseUuid,
      classes: classUuids,
      professors: professorUuids,
      students: [],
      code: "TEMP",
    });

    const universityId = (course.university as any)._id.toString();

    const classCodes = [];
    for (const classItem of classes) {
      let classCode;
      let attempts = 0;

      do {
        classCode = generateDisciplineCode(
            universityId,
            courseId,
            classItem._id.toString(),
            discipline._id.toString()
        );

        const existingCode = await Discipline.findOne({ code: classCode });
        if (!existingCode) break;

        attempts++;
        if (attempts > 10) {
          throw new AppError("erro ao gerar código único!", 500);
        }
      } while (attempts <= 10);

      classCodes.push({
        classId: classItem._id,
        className: classItem.name,
        code: classCode
      });
    }

    discipline.code = classCodes[0].code;
    await discipline.save();

    course.disciplines.push(discipline._id as Types.Uuid);
    await course.save();

    await Class.updateMany(
        { _id: { $in: classUuids } },
        { $addToSet: { disciplines: discipline._id } }
    );

    await Professor.updateMany(
        { _id: { $in: professorUuids } },
        {
          $addToSet: {
            disciplines: discipline._id,
            classes: { $each: classUuids }
          }
        }
    );

    return {
      discipline: await discipline.populate(["course", "classes", "professors"]),
      classCodes,
      universityName: (course.university as any).name,
      courseName: course.name
    };
  }
}

export { CreateDisciplineService };
