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
exports.ListProfessorsByCourseController = void 0;
const ListProfessorsByCourseService_1 = require("../../../services/admin/admin/ListProfessorsByCourseService");
class ListProfessorsByCourseController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { courseId } = req.params;
            const roles = Array.isArray((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) ? req.user.role : [(_b = req.user) === null || _b === void 0 ? void 0 : _b.role];
            if (!roles.includes("admin") && !roles.includes("course-coordinator")) {
                return res.status(403).json({ error: "Apenas administradores ou coordenadores de curso podem acessar esta rota." });
            }
            const service = new ListProfessorsByCourseService_1.ListProfessorsByCourseService();
            const professors = yield service.execute(courseId);
            return res.status(200).json(professors);
        });
    }
}
exports.ListProfessorsByCourseController = ListProfessorsByCourseController;
