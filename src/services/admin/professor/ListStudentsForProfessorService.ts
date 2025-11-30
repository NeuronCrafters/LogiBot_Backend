import { Professor } from "../../../models/Professor";
import { User, IUser } from "../../../models/User";

export async function ListStudentsForProfessorService(
  professorId: string
): Promise<IUser[]> {
  const prof = await Professor.findById(professorId).select(
    "disciplines school courses"
  );

  if (!prof) {
    throw new Error("professor não encontrado.");
  }

  return User.find({
    role: "student",
    school: prof.school,
    course: { $in: prof.courses },
    disciplines: { $in: prof.disciplines },
  })
    .select("name email disciplines course class")
    .populate("disciplines", "name code")
    .exec();
}