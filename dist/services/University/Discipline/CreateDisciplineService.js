"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDisciplineService = void 0;
const Discipline_1 = require("../../../models/Discipline");
const Course_1 = require("../../../models/Course");
const Class_1 = require("../../../models/Class");
const Professor_1 = require("../../../models/Professor");
const AppError_1 = require("../../../exceptions/AppError");
const mongoose_1 = require("mongoose");
const generateCode_1 = require("../../../config/generateCode");
class CreateDisciplineService {
    execute(name, courseId, classIds, professorIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(courseId)) {
                throw new AppError_1.AppError("ID do curso inválido!", 400);
            }
            const courseObjectId = new mongoose_1.Types.ObjectId(courseId);
            // Buscar curso com universidade populada
            const course = yield Course_1.Course.findById(courseObjectId).populate('university');
            if (!course) {
                throw new AppError_1.AppError("Curso não encontrado!", 404);
            }
            if (!Array.isArray(classIds) || classIds.some(id => !mongoose_1.Types.ObjectId.isValid(id))) {
                throw new AppError_1.AppError("IDs de turma inválidos!", 400);
            }
            const classObjectIds = classIds.map(id => new mongoose_1.Types.ObjectId(id));
            const classes = yield Class_1.Class.find({ _id: { $in: classObjectIds } });
            if (classes.length !== classIds.length) {
                throw new AppError_1.AppError("Uma ou mais turmas não foram encontradas!", 404);
            }
            if (!Array.isArray(professorIds) || professorIds.some(id => !mongoose_1.Types.ObjectId.isValid(id))) {
                throw new AppError_1.AppError("IDs de professor inválidos!", 400);
            }
            const professorObjectIds = professorIds.map(id => new mongoose_1.Types.ObjectId(id));
            const existingDiscipline = yield Discipline_1.Discipline.findOne({ name, course: courseObjectId });
            if (existingDiscipline) {
                throw new AppError_1.AppError("Disciplina já existe para este curso!", 409);
            }
            // Criar disciplina primeiro para ter o ID
            const discipline = yield Discipline_1.Discipline.create({
                name,
                course: courseObjectId,
                classes: classObjectIds,
                professors: professorObjectIds,
                students: [],
                code: "TEMP", // código temporário
            });
            // Obter o ID da universidade
            const universityId = course.university._id.toString();
            // Gerar códigos únicos para cada turma desta disciplina
            const classCodes = [];
            for (const classItem of classes) {
                let classCode;
                let attempts = 0;
                // Gerar código único, verificando se já existe
                do {
                    classCode = (0, generateCode_1.generateDisciplineCode)(universityId, courseId, classItem._id.toString(), discipline._id.toString());
                    const existingCode = yield Discipline_1.Discipline.findOne({ code: classCode });
                    if (!existingCode)
                        break;
                    attempts++;
                    if (attempts > 10) {
                        throw new AppError_1.AppError("Erro ao gerar código único!", 500);
                    }
                } while (attempts <= 10);
                classCodes.push({
                    classId: classItem._id,
                    className: classItem.name,
                    code: classCode
                });
            }
            // Usar o primeiro código como código principal da disciplina
            discipline.code = classCodes[0].code;
            yield discipline.save();
            // Atualizar relacionamentos
            course.disciplines.push(discipline._id);
            yield course.save();
            yield Class_1.Class.updateMany({ _id: { $in: classObjectIds } }, { $addToSet: { disciplines: discipline._id } });
            yield Professor_1.Professor.updateMany({ _id: { $in: professorObjectIds } }, { $addToSet: { disciplines: discipline._id } });
            return {
                discipline: yield discipline.populate(['course', 'classes', 'professors']),
                classCodes: classCodes,
                universityName: course.university.name,
                courseName: course.name
            };
        });
    }
}
exports.CreateDisciplineService = CreateDisciplineService;
