// import { Professor } from "../../../models/Professor";
// import { User, IUser } from "../../../models/User";

// /**
//  * Retorna todos os alunos que estão matriculados em
//  * quaisquer disciplinas que o próprio professor ministra.
//  *
//  * @param professorId  ID do professor (obtido do token)
//  * @returns lista de IUser (role inclui "student")
//  */
// export async function ListStudentsForProfessorService(
//   professorId: string
// ): Promise<IUser[]> {
//   const prof = await Professor.findById(professorId).select(
//     "disciplines school course"
//   );

//   if (!prof) {
//     throw new Error("Professor não encontrado.");
//   }

//   return User.find({
//     role: "student",
//     school: prof.school,
//     course: { $in: prof.courses },
//     disciplines: { $in: prof.disciplines },
//   }).exec();
// }

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
    "disciplines school courses" // Certifique-se de selecionar 'courses' (plural) se o model usar plural
  );

  if (!prof) {
    throw new Error("Professor não encontrado.");
  }

  return User.find({
    role: "student",
    school: prof.school,
    // Garante alunos dos cursos onde o professor atua
    course: { $in: prof.courses },
    // Garante alunos que pegam as disciplinas do professor
    disciplines: { $in: prof.disciplines },
  })
    .select("name email disciplines course class") // Traz os campos necessários
    .populate("disciplines", "name code") // <--- O SEGREDO: Popula para o filtro funcionar
    .exec();
}