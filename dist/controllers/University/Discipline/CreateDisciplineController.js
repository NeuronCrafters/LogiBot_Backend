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
exports.CreateDisciplineController = void 0;
const CreateDisciplineService_1 = require("../../../services/University/Discipline/CreateDisciplineService");
class CreateDisciplineController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, courseId, classIds, professorIds } = req.body;
                if (!name || !courseId || !classIds) {
                    return res
                        .status(400)
                        .json({ message: "Os campos 'name', 'courseId' e 'classIds' são obrigatórios!" });
                }
                const createDisciplineService = new CreateDisciplineService_1.CreateDisciplineService();
                const discipline = yield createDisciplineService.execute(name, courseId, classIds, professorIds || []);
                return res.status(201).json(discipline);
            }
            catch (error) {
                return res.status(error.statusCode || 500).json({ message: error.message });
            }
        });
    }
}
exports.CreateDisciplineController = CreateDisciplineController;
