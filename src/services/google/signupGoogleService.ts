import { sign } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Discipline } from "../../models/Discipline";
import domainToSchoolMap from "../../config/socialLogin/domainToSchoolMap.json";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";

class SignupGoogleService {
  async create(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new AppError("Email não encontrado no perfil do Google.", 400);
    }

    const emailDomain = email.split("@")[1];
    const schoolName = domainToSchoolMap[emailDomain];
    if (!schoolName) {
      throw new AppError("Domínio do email não permitido ou não mapeado.", 403);
    }

    const schoolQuery = Types.ObjectId.isValid(schoolName)
      ? { _id: schoolName }
      : { name: schoolName };

    const university = await University.findOne(schoolQuery);
    if (!university) {
      throw new AppError("Universidade não encontrada.", 404);
    }

    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      const course = await Course.findOne({ university: university._id });
      if (!course) {
        throw new AppError("Curso padrão para a universidade não encontrado.", 404);
      }

      const classData = await Class.findOne({ course: course._id });
      if (!classData) {
        throw new AppError("Turma padrão para o curso não encontrada.", 404);
      }

      user = new User({
        googleId: profile.id,
        name: profile.displayName,
        email,
        school: university._id,
        course: course._id,
        class: classData._id,
        photo: profile.photos?.[0]?.value || null,
      });
      await user.save();

      if (!classData.students.includes(user._id as Types.ObjectId)) {
        classData.students.push(user._id as Types.ObjectId);
        await classData.save();
      }

      const disciplines = await Discipline.find({ classes: classData._id });

      if (disciplines.length > 0) {
        const disciplineIds = disciplines.map((discipline) => discipline._id as Types.ObjectId);
        user.disciplines = disciplineIds;
        await user.save();

        const professorIds = disciplines.flatMap((discipline) => discipline.professors);
        await Professor.updateMany(
          { _id: { $in: professorIds } },
          { $addToSet: { students: user._id } }
        );

        for (const discipline of disciplines) {
          if (!discipline.students.includes(user._id as Types.ObjectId)) {
            discipline.students.push(user._id as Types.ObjectId);
            await discipline.save();
          }
        }
      }
    }

    const secret = process.env.JWT_SECRET || "defaultSecret";
    const token = sign({ sub: user.id, role: user.role }, secret, {
      expiresIn: "1h",
    });

    return { user, token };
  }
}

export { SignupGoogleService };
