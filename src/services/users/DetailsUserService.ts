// src/services/users/DetailsUserService.ts
import { AppError } from "../../exceptions/AppError";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

interface Output {
  /* dados “primários” ---------------------------------------------------- */
  _id: string;
  name: string;
  email: string;
  role: string[];

  schoolId: string;
  schoolName: string;

  /* para estudantes (¬ obrigatórios p/ professor) ------------------------ */
  courseId?: string;
  courseName?: string;
  classId?: string;
  className?: string;

  /* coleções completas (professor / coordenador) ------------------------- */
  courses?: { id: string; name: string }[];
  classes?: { id: string; name: string }[];
  disciplines?: { id: string; name: string }[];
}

class DetailsUserService {
  async detailsUser(user_id: string, role: string | string[]): Promise<Output> {
    /* ------------------------------------------------------------------ */
    /* identifica papéis                                                  */
    /* ------------------------------------------------------------------ */
    const roles = Array.isArray(role) ? role : [role];
    const isCoordinator = roles.includes("course-coordinator");
    const isProfessor   = roles.includes("professor");
    const isStudent     = roles.includes("student");
    const isAdmin       = roles.includes("admin");

    /* ------------------------------------------------------------------ */
    /* consulta conforme o papel                                          */
    /* ------------------------------------------------------------------ */
    let raw: any = null;

    if (isCoordinator || isProfessor) {
      raw = await Professor.findById(user_id)
          .select("name email role school courses classes disciplines")
          .populate({ path: "school",      select: "name" })
          .populate({ path: "courses",     select: "name" })
          .populate({ path: "classes",     select: "name" })   // ✅ agora traz turmas
          .populate({ path: "disciplines", select: "name" })   // (nome da disciplina)
          .lean();
    } else if (isStudent || isAdmin) {
      raw = await User.findById(user_id)
          .select("name email role school course class")
          .populate({ path: "school", select: "name" })
          .populate({ path: "course", select: "name" })
          .populate({ path: "class",  select: "name" })
          .lean();
    } else {
      throw new AppError("Papel inválido!", 400);
    }

    if (!raw) throw new AppError("Usuário não encontrado!", 404);

    /* ------------------------------------------------------------------ */
    /* monta objeto de saída padronizado                                   */
    /* ------------------------------------------------------------------ */
    const out: Output = {
      _id:       String(raw._id),
      name:      raw.name,
      email:     raw.email,
      role:      Array.isArray(raw.role) ? raw.role : [raw.role],

      schoolId:   String(raw.school?._id),
      schoolName: raw.school?.name ?? "",

      /* campos “simples” (existem para estudante/admin) ---------------- */
      courseId: raw.course ? String(raw.course._id) : undefined,
      courseName: raw.course ? raw.course.name : undefined,
      classId:  raw.class  ? String(raw.class._id)  : undefined,
      className: raw.class ? raw.class.name         : undefined,

      /* coleções (existem p/ professor/coordenador) -------------------- */
      courses:    raw.courses
          ? (raw.courses as any[]).map(c => ({ id: String(c._id), name: c.name }))
          : undefined,

      classes:    raw.classes
          ? (raw.classes as any[]).map(cl => ({ id: String(cl._id), name: cl.name }))
          : undefined,

      disciplines: raw.disciplines
          ? (raw.disciplines as any[]).map(d => ({ id: String(d._id), name: d.name }))
          : undefined,
    };

    return out;
  }
}

export { DetailsUserService };
