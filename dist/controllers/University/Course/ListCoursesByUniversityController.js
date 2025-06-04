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
exports.ListCoursesByUniversityController = void 0;
const ListCoursesByUniversityService_1 = require("../../../services/University/Course/ListCoursesByUniversityService");
class ListCoursesByUniversityController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { universityId } = req.params;
                if (!universityId) {
                    return res.status(400).json({ message: "ID da universidade é obrigatório!" });
                }
                const listCoursesByUniversityService = new ListCoursesByUniversityService_1.ListCoursesByUniversityService();
                const courses = yield listCoursesByUniversityService.execute(universityId);
                return res.status(200).json(courses);
            }
            catch (error) {
                console.error("Erro ao listar cursos:", error.message);
                return res.status(error.statusCode || 500).json({
                    message: error.message || "Erro interno no servidor.",
                });
            }
        });
    }
}
exports.ListCoursesByUniversityController = ListCoursesByUniversityController;
