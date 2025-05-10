import { Professor, IProfessor } from "../../../models/Professor";

/**
 * Retorna todos os professores que pertencem à mesma escola e
 * ao mesmo curso do coordenador.
 *
 * @param schoolId  ID da universidade do coordenador
 * @param courseId  ID do curso do coordenador
 * @returns lista de IProfessor
 */
export async function ListProfessorsForCoordinatorService(
  schoolId: string,
  courseId: string
): Promise<IProfessor[]> {
  return Professor.find({
    school: schoolId,
    courses: courseId,
  }).exec();
}
