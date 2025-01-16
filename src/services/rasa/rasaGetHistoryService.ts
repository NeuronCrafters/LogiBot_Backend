import { History, IHistory } from "../../models/History";
import { User, IUser } from "../../models/User";
import { Professor, IProfessor } from "../../models/Professor";

class RasaGetHistoryService {
  async execute(
    filters: { studentId?: string; classId?: string },
    user: { id: string; role: string[]; school: string | null }
  ): Promise<IHistory[]> {
    console.log("Iniciando a execução do serviço com filtros:", filters);
    console.log("Usuário autenticado:", user);

    const { role, id, school } = user;
    const { studentId, classId } = filters;

    const filter: any = {};

    if (studentId) {
      filter.student = studentId;
    }

    if (classId) {
      const studentsInClass = await User.find({ classId }).select("_id");
      const studentIds = studentsInClass.map((student) => student._id.toString());
      filter.student = { $in: studentIds };
    }

    if (role.includes("admin")) {
      console.log("Admin acessando históricos com filtro:", filter);
      return History.find(filter).populate("student").exec();
    }

    if (role.includes("professor")) {
      const professor = await Professor.findById(id).populate("students");
      if (!professor || !professor.students) {
        console.log("Professor sem alunos associados.");
        return [];
      }
      const allowedStudentIds = professor.students.map((studentId) => studentId.toString());

      if (filter.student && Array.isArray(filter.student.$in)) {
        filter.student.$in = filter.student.$in.filter((id) => allowedStudentIds.includes(id));
      } else if (filter.student && typeof filter.student === "string") {
        if (!allowedStudentIds.includes(filter.student)) {
          throw new Error("Permissão negada para acessar o histórico desse aluno.");
        }
      } else {
        filter.student = { $in: allowedStudentIds };
      }

      console.log("Professor acessando históricos com filtro:", filter);
      return History.find(filter).populate("student").exec();
    }

    if (role.includes("course-coordinator")) {
      if (!school) {
        throw new Error("Coordenador de curso não tem escola associada.");
      }
      const students = await User.find({ school }).select("_id");
      const studentIds = students.map((student) => student._id.toString());
      filter.student = { $in: studentIds };

      console.log("Coordenador de curso acessando históricos com filtro:", filter);
      return History.find(filter).populate("student").exec();
    }

    throw new Error("Permissão negada.");
  }
}

export { RasaGetHistoryService };
