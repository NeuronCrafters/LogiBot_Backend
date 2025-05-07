import { Discipline } from "../../../models/Discipline";

class ListDisciplinesService {
  async execute() {
    const disciplines = await Discipline.find()
      .populate("course", "name")
      .populate({
        path: "classes",
        select: "name code",
      })
      .populate({
        path: "professors",
        select: "name email",
      })
      .populate({
        path: "students",
        select: "name email",
      });

    return disciplines;
  }
}

export { ListDisciplinesService };
