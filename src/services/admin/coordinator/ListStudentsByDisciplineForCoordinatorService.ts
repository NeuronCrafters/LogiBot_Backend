import { User, IUser } from "@/models/User";

/**
 * Retorna todos os alunos da disciplina especificada,
 * desde que pertençam ao mesmo curso e escola do coordenador.
 *
 * @param schoolId      ID da universidade do coordenador
 * @param courseId      ID do curso do coordenador
 * @param disciplineId  ID da disciplina
 * @returns lista de IUser (role inclui "student")
 */
export async function ListStudentsByDisciplineForCoordinatorService(
  schoolId: string,
  courseId: string,
  disciplineId: string
): Promise<IUser[]> {
  return User.find({
    role: "student",
    school: schoolId,
    course: courseId,
    disciplines: disciplineId,
  }).exec();
}
