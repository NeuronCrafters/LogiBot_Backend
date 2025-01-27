import { Discipline } from "../../models/Discipline";
import { Class } from "../../models/Class";
import { AppError } from "../../exceptions/AppError";

class createDisciplineService {
  async create(code: string, name: string, classIds: string[]) {
    const classes = await Class.find({ _id: { $in: classIds } });
    if (!classes || classes.length === 0) {
      throw new AppError("Nenhuma turma válida encontrada!", 404);
    }

    const existingDiscipline = await Discipline.findOne({ code, name });
    if (existingDiscipline) {
      throw new AppError("Disciplina já existe!", 409);
    }

    const discipline = await Discipline.create({ code, name, classes: classIds });
    return discipline;
  }

  async list() {
    const disciplines = await Discipline.find().populate("classes");
    return disciplines;
  }
}

export { createDisciplineService };
