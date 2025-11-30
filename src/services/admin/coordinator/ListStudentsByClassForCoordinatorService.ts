import { Types } from "mongoose";
import { Class } from "../../../models/Class";
import { User, IUser } from "../../../models/User";

export async function ListStudentsByClassForCoordinatorService(
    schoolId: string | undefined,
    courseId: string,
    classId: string
): Promise<Pick<IUser, "_id" | "name" | "email">[]> {
    if (!Types.ObjectId.isValid(classId)) {
        throw new Error("classid inválido");
    }

    const classDoc = await Class.findById(classId)
        .select("course students")
        .lean<{ course: Types.ObjectId; students: Types.ObjectId[] }>();

    if (!classDoc) {
        throw new Error("turma não encontrada");
    }

    if (classDoc.course.toString() !== courseId) {
        throw new Error("turma não pertence a este curso");
    }

    if (!classDoc.students?.length) return [];

    const query: Record<string, any> = {
        _id: { $in: classDoc.students },
        role: "student",
        course: courseId,
    };

    if (schoolId) {
        query.school = schoolId;
    }

    return User.find(query)
        .select("_id name email")
        .lean<Pick<IUser, "_id" | "name" | "email">[]>()
        .exec();
}
