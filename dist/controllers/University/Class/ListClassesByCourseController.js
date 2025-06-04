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
exports.ListClassesByCourseController = void 0;
const ListClassesByCourseService_1 = require("../../../services/University/Class/ListClassesByCourseService");
class ListClassesByCourseController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { courseId } = req.params;
                const listClassesByCourseService = new ListClassesByCourseService_1.ListClassesByCourseService();
                const classes = yield listClassesByCourseService.listClassByCouse(courseId);
                return res.status(200).json(classes);
            }
            catch (error) {
                console.error("Erro ao listar turmas:", error.message);
                return res.status(error.statusCode || 500).json({
                    message: error.message || "Erro interno no servidor.",
                });
            }
        });
    }
}
exports.ListClassesByCourseController = ListClassesByCourseController;
