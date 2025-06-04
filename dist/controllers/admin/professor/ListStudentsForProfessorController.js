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
exports.ListStudentsForProfessorController = ListStudentsForProfessorController;
const ListStudentsForProfessorService_1 = require("../../../services/admin/professor/ListStudentsForProfessorService");
function ListStudentsForProfessorController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = req.user;
        if (!user.role.includes("professor")) {
            return res.status(403).json({ message: "Acesso negado." });
        }
        const students = yield (0, ListStudentsForProfessorService_1.ListStudentsForProfessorService)(user.id);
        return res.json(students);
    });
}
