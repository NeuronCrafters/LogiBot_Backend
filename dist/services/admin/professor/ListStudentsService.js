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
exports.ListStudentsService = void 0;
const User_1 = require("../../../models/User");
const Professor_1 = require("../../../models/Professor");
const AppError_1 = require("../../../exceptions/AppError");
class ListStudentsService {
    execute(_a) {
        return __awaiter(this, arguments, void 0, function* ({ requesterId, requesterRole }) {
            const roles = Array.isArray(requesterRole) ? requesterRole : [requesterRole];
            try {
                if (roles.includes("admin")) {
                    return yield User_1.User.find({ role: { $in: ["student"] } })
                        .select("name email course class disciplines")
                        .populate({
                        path: "disciplines",
                        select: "name code professors",
                        populate: {
                            path: "professors",
                            select: "name email"
                        }
                    })
                        .lean();
                }
                if (roles.includes("course-coordinator")) {
                    const coordinator = yield Professor_1.Professor.findById(requesterId).lean();
                    if (!coordinator)
                        throw new AppError_1.AppError("Coordenador não encontrado.", 404);
                    return yield User_1.User.find({
                        role: { $in: ["student"] },
                        course: { $in: coordinator.courses }
                    })
                        .select("name email course class disciplines")
                        .populate({
                        path: "disciplines",
                        select: "name code professors",
                        populate: {
                            path: "professors",
                            select: "name email"
                        }
                    })
                        .lean();
                }
                if (roles.includes("professor")) {
                    const professor = yield Professor_1.Professor.findById(requesterId).lean();
                    if (!professor)
                        throw new AppError_1.AppError("Professor não encontrado.", 404);
                    return yield User_1.User.find({
                        role: { $in: ["student"] },
                        disciplines: { $exists: true, $ne: [] }
                    })
                        .select("name email disciplines")
                        .populate({
                        path: "disciplines",
                        match: { professors: requesterId },
                        select: "name code"
                    })
                        .lean();
                }
                throw new AppError_1.AppError("Acesso negado. Permissão insuficiente.", 403);
            }
            catch (error) {
                console.error("Erro ao listar alunos:", error);
                if (error instanceof AppError_1.AppError)
                    throw error;
                throw new AppError_1.AppError("Erro interno ao processar a listagem de alunos.", 500);
            }
        });
    }
}
exports.ListStudentsService = ListStudentsService;
