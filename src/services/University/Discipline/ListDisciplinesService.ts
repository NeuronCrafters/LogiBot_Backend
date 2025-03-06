import { Discipline } from "../../../models/Discipline";

class ListDisciplinesService {
  async execute() {
    const disciplines = await Discipline.find()
      .populate("course", "name")
      .populate("classes", "name")
      .populate("professors", "name");

    return disciplines;
  }
}

export { ListDisciplinesService };
