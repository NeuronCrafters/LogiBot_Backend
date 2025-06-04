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
exports.CreateUniversityService = void 0;
const University_1 = require("../../../models/University");
const AppError_1 = require("../../../exceptions/AppError");
class CreateUniversityService {
    execute(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingUniversity = yield University_1.University.findOne({ name });
            if (existingUniversity) {
                throw new AppError_1.AppError("Universidade já existe!", 409);
            }
            const university = yield University_1.University.create({ name });
            return university;
        });
    }
}
exports.CreateUniversityService = CreateUniversityService;
