"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.Professor = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ProfessorSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: [String], enum: ["professor", "course-coordinator"], default: ["professor"] },
    school: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "University", required: true },
    courses: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Course" }],
    disciplines: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Discipline" }],
    students: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" }],
    googleId: { type: String, required: false },
    photo: { type: String, required: false },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },
}, {
    timestamps: true,
});
ProfessorSchema.pre("findOneAndDelete", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const professor = yield this.model.findOne(this.getFilter());
        if (professor) {
            yield mongoose_1.default.model("Course").updateMany({ _id: { $in: professor.courses } }, { $pull: { professors: professor._id } });
            yield mongoose_1.default.model("Discipline").updateMany({ professors: professor._id }, { $pull: { professors: professor._id } });
        }
        next();
    });
});
exports.Professor = mongoose_1.default.model("Professor", ProfessorSchema);
