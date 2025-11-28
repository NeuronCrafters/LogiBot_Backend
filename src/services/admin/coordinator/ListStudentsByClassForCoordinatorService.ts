import { Types } from "mongoose";
import { Class } from "../../../models/Class";
import { User, IUser } from "../../../models/User";

export async function ListStudentsByClassForCoordinatorService(
    schoolId: string | undefined,
    courseId: string,
    classId: string
): Promise<Pick<IUser, "_id" | "name" | "email">[]> {
    // 1) valida classId
    if (!Types.ObjectId.isValid(classId)) {
        throw new Error("classid inválido");
    }

    // 2) busca a turma e seus alunos
    const classDoc = await Class.findById(classId)
        .select("course students")
        .lean<{ course: Types.ObjectId; students: Types.ObjectId[] }>();

    if (!classDoc) {
        throw new Error("turma não encontrada");
    }

    // 3) garante que a turma é do curso passado
    if (classDoc.course.toString() !== courseId) {
        throw new Error("turma não pertence a este curso");
    }

    // 4) se não tiver alunos, retorna vazio
    if (!classDoc.students?.length) return [];

    // 5) monta a query de alunos
    const query: Record<string, any> = {
        _id: { $in: classDoc.students },
        role: "student",
        course: courseId,
    };

    // só adiciona school se for truthy (coordenador)
    if (schoolId) {
        query.school = schoolId;
    }

    // 6) busca e retorna
    return User.find(query)
        .select("_id name email")
        .lean<Pick<IUser, "_id" | "name" | "email">[]>()
        .exec();
}
