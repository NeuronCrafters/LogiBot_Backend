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
exports.ListStudentsByClassForCoordinatorService = ListStudentsByClassForCoordinatorService;
const mongoose_1 = require("mongoose");
const Class_1 = require("../../../models/Class");
const User_1 = require("../../../models/User");
function ListStudentsByClassForCoordinatorService(schoolId, courseId, classId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // 1) valida classId
        if (!mongoose_1.Types.ObjectId.isValid(classId)) {
            throw new Error("classId inválido");
        }
        // 2) busca a turma e seus alunos
        const classDoc = yield Class_1.Class.findById(classId)
            .select("course students")
            .lean();
        if (!classDoc) {
            throw new Error("Turma não encontrada");
        }
        // 3) garante que a turma é do curso passado
        if (classDoc.course.toString() !== courseId) {
            throw new Error("Turma não pertence a este curso");
        }
        // 4) se não tiver alunos, retorna vazio
        if (!((_a = classDoc.students) === null || _a === void 0 ? void 0 : _a.length))
            return [];
        // 5) monta a query de alunos
        const query = {
            _id: { $in: classDoc.students },
            role: "student",
            course: courseId,
        };
        // só adiciona school se for truthy (coordenador)
        if (schoolId) {
            query.school = schoolId;
        }
        // 6) busca e retorna
        return User_1.User.find(query)
            .select("_id name email")
            .lean()
            .exec();
    });
}
