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
exports.ListProfessorsService = void 0;
const Professor_1 = require("../../models/Professor");
class ListProfessorsService {
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const professors = yield Professor_1.Professor.find();
                return professors.map((professor) => ({
                    id: professor._id.toString(),
                    name: professor.name,
                    email: professor.email,
                    role: professor.role,
                }));
            }
            catch (error) {
                throw new Error("Erro ao listar professores.");
            }
        });
    }
}
exports.ListProfessorsService = ListProfessorsService;
