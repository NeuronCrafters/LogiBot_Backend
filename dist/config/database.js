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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function connectDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const uri = process.env.MONGO_URI;
            if (!uri) {
                throw new Error("MONGO_URI não está configurada no .env");
            }
            yield mongoose_1.default.connect(uri, {
            // Essas opções já não são mais necessárias nas versões mais recentes do Mongoose,
            // Mas fica aí de dica para projetos "legados"
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            });
            console.log("Conexão com o MongoDB estabelecida com sucesso!");
        }
        catch (error) {
            console.error("Erro ao conectar no MongoDB:", error);
            process.exit(1);
        }
    });
}
