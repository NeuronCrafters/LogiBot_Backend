import { User, IUser } from "../../../models/User";

/**
 * Retorna todos os alunos que pertencem à mesma escola e
 * ao mesmo curso do coordenador.
 *
 * @param schoolId  ID da universidade do coordenador
 * @param courseId  ID do curso do coordenador
 * @returns lista de IUser (role inclui "student")
 */
export async function ListStudentsForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IUser[]> {
  return User.find({
    role: "student",
    school: schoolId,
    course: courseId,
  }).exec();
}
