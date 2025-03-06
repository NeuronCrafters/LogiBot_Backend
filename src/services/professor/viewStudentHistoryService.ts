import { History } from "../../models/History";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { AppError } from "../../exceptions/AppError";

class ViewStudentHistoryService {
  async execute(professorId: string, studentId: string): Promise<any> {

    const professor = await Professor.findById(professorId).populate("students");
    if (!professor) {
      throw new AppError("Professor não encontrado.", 404);
    }

    const studentIsAssociated = professor.students.some(
      (student: any) => student._id.toString() === studentId
    );
    if (!studentIsAssociated) {
      throw new AppError("O aluno não está associado a este professor.", 403);
    }

    const student = await User.findById(studentId);
    if (!student || !student.role.includes("student")) {
      throw new AppError("Aluno não encontrado ou não é válido.", 404);
    }

    const historyRecords = await History.find({ student: studentId });

    return historyRecords.map((history) => ({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
      },
      messages: history.messages.map((message) => ({
        sender: message.sender,
        text: message.text,
      })),
      startTime: history.startTime,
      endTime: history.endTime,
    }));
  }
}

export { ViewStudentHistoryService };
