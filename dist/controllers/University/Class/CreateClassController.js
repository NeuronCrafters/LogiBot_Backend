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
exports.CreateClassController = void 0;
const CreateClassService_1 = require("../../../services/University/Class/CreateClassService");
class CreateClassController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, courseId } = req.body;
                const createClassService = new CreateClassService_1.CreateClassService();
                const classData = yield createClassService.execute(name, courseId);
                return res.status(201).json(classData);
            }
            catch (error) {
                console.error("Erro ao criar turma:", error.message);
                return res.status(error.statusCode || 500).json({
                    message: error.message || "Erro interno no servidor.",
                });
            }
        });
    }
}
exports.CreateClassController = CreateClassController;
