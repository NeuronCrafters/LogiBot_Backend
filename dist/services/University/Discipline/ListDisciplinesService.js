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
exports.ListDisciplinesService = void 0;
const Discipline_1 = require("../../../models/Discipline");
class ListDisciplinesService {
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            const disciplines = yield Discipline_1.Discipline.find()
                .populate("course", "name")
                .populate({
                path: "classes",
                select: "name code",
            })
                .populate({
                path: "professors",
                select: "name email",
            })
                .populate({
                path: "students",
                select: "name email",
            });
            return disciplines;
        });
    }
}
exports.ListDisciplinesService = ListDisciplinesService;
