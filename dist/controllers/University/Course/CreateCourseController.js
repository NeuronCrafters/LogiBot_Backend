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
exports.CreateCourseController = void 0;
const CreateCourseService_1 = require("../../../services/University/Course/CreateCourseService");
class CreateCourseController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, universityId } = req.body;
                if (!name || !universityId) {
                    return res.status(400).json({ message: "Nome e ID da universidade são obrigatórios!" });
                }
                const createCourseService = new CreateCourseService_1.CreateCourseService();
                const course = yield createCourseService.execute(name, universityId);
                return res.status(201).json(course);
            }
            catch (error) {
                console.error("Erro ao criar curso:", error.message);
                return res.status(error.statusCode || 500).json({
                    message: error.message || "Erro interno no servidor.",
                });
            }
        });
    }
}
exports.CreateCourseController = CreateCourseController;
