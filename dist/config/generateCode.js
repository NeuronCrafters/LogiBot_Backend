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
exports.generateDisciplineCode = generateDisciplineCode;
exports.findEntitiesByCode = findEntitiesByCode;
exports.generateDisciplineCodeCRC = generateDisciplineCodeCRC;
exports.generateDisciplineCodeSimple = generateDisciplineCodeSimple;
function generateHash(universityId, courseId, classId, disciplineId) {
    const combined = `${universityId}${courseId}${classId}${disciplineId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Converter para string de 8 caracteres alfanuméricos
    const base36 = Math.abs(hash).toString(36).toUpperCase();
    return base36.padStart(8, '0').substring(0, 8);
}
function generateDisciplineCode(universityId, courseId, classId, disciplineId) {
    return generateHash(universityId, courseId, classId, disciplineId);
}
// Função para buscar entidades pelo código (já que não podemos decodificar hash)
function findEntitiesByCode(code) {
    return __awaiter(this, void 0, void 0, function* () {
        const { Discipline } = yield Promise.resolve().then(() => __importStar(require("../models/Discipline")));
        try {
            // Buscar disciplina pelo código e popular todas as referências necessárias
            const discipline = yield Discipline.findOne({ code })
                .populate({
                path: 'course',
                populate: {
                    path: 'university'
                }
            })
                .populate('classes');
            if (!discipline) {
                return null;
            }
            const course = discipline.course;
            const university = course.university;
            return {
                university,
                course,
                discipline,
                classes: discipline.classes
            };
        }
        catch (error) {
            return null;
        }
    });
}
// Versão alternativa usando CRC32 para mais consistência
function crc32(str) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < str.length; i++) {
        crc = (crc >>> 8) ^ ((crc ^ str.charCodeAt(i)) & 0xFF);
    }
    return (crc ^ (-1)) >>> 0;
}
function generateDisciplineCodeCRC(universityId, courseId, classId, disciplineId) {
    const combined = `${universityId}${courseId}${classId}${disciplineId}`;
    const hash = crc32(combined);
    const base36 = hash.toString(36).toUpperCase();
    return base36.padStart(8, '0').substring(0, 8);
}
// Manter função simples como backup
function generateDisciplineCodeSimple() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}
