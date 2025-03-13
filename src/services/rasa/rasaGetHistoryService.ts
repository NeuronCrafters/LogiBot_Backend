import { UserAnalysis } from "../../models/UserAnalysis";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

class RasaGetHistoryService {
  async execute(
    filters: { studentId?: string; classId?: string },
    user: { id: string; role: string[]; school: string | null }
  ) {
    console.log("Iniciando a execução do serviço com filtros:", filters);
    console.log("Usuário autenticado:", user);

    const { role, id, school } = user;
    const { studentId, classId } = filters;

    const filter: any = {};

    // Se um aluno específico for solicitado
    if (studentId) {
      filter.userId = studentId;
    }

    // Se for filtrado por turma (classId)
    if (classId) {
      const studentsInClass = await User.find({ class: classId }).select("_id");
      const studentIds = studentsInClass.map((student) => student._id.toString());
      filter.userId = { $in: studentIds };
    }

    // Se for admin, pode acessar tudo
    if (role.includes("admin")) {
      console.log("Admin acessando todos os dados com filtro:", filter);
      return UserAnalysis.find(filter).exec();
    }

    // Se for professor, pode acessar apenas alunos que supervisiona
    if (role.includes("professor")) {
      const professor = await Professor.findById(id).populate("students");
      if (!professor || !professor.students) {
        console.log("Professor sem alunos associados.");
        return [];
      }

      const allowedStudentIds = professor.students.map((studentId) => studentId.toString());

      if (filter.userId && Array.isArray(filter.userId.$in)) {
        filter.userId.$in = filter.userId.$in.filter((id) => allowedStudentIds.includes(id));
      } else if (filter.userId && typeof filter.userId === "string") {
        if (!allowedStudentIds.includes(filter.userId)) {
          throw new Error("Permissão negada para acessar os dados desse aluno.");
        }
      } else {
        filter.userId = { $in: allowedStudentIds };
      }

      console.log("Professor acessando dados com filtro:", filter);
      return UserAnalysis.find(filter).exec();
    }

    // Se for coordenador de curso, pode acessar apenas alunos da sua universidade
    if (role.includes("course-coordinator")) {
      if (!school) {
        throw new Error("Coordenador de curso não tem escola associada.");
      }
      const students = await User.find({ school }).select("_id");
      const studentIds = students.map((student) => student._id.toString());
      filter.userId = { $in: studentIds };

      console.log("Coordenador de curso acessando dados com filtro:", filter);
      return UserAnalysis.find(filter).exec();
    }

    throw new Error("Permissão negada.");
  }
}

export { RasaGetHistoryService };
