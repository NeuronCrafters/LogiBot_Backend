import { Professor } from "../../../models/Professor";
import { User, IUser } from "../../../models/User";

/**
 * Retorna todos os alunos que estão matriculados em
 * quaisquer disciplinas que o próprio professor ministra.
 *
 * @param professorId  ID do professor (obtido do token)
 * @returns lista de IUser (role inclui "student")
 */
export async function ListStudentsForProfessorService(
  professorId: string
): Promise<IUser[]> {
  const prof = await Professor.findById(professorId).select(
    "disciplines school course"
  );

  if (!prof) {
    throw new Error("Professor não encontrado.");
  }

  return User.find({
    role: "student",
    school: prof.school,
    course: { $in: prof.courses },
    disciplines: { $in: prof.disciplines },
  }).exec();
}
