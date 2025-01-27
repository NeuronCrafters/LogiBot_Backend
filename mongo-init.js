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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongodb_1 = require("mongodb");
var bcryptjs_1 = require("bcryptjs");
var MONGO_URI = process.env.MONGO_URI || "mongodb://root:example@localhost:27017";
var DB_NAME = process.env.DB_NAME || "ChatSAEL";
var initializeDatabase = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client, db, hashedPassword, users, professors, professorsCollection, _i, professors_1, professor, existingProfessor, usersCollection, _a, users_1, user, existingUser, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 16, , 17]);
                client = new mongodb_1.MongoClient(MONGO_URI);
                return [4 /*yield*/, client.connect()];
            case 1:
                _b.sent();
                console.log("Conectado ao MongoDB");
                db = client.db(DB_NAME);
                return [4 /*yield*/, (0, bcryptjs_1.hash)("password123", 10)];
            case 2:
                hashedPassword = _b.sent();
                users = [
                    {
                        _id: new mongodb_1.ObjectId("677e9e92a0735cfd26a96c0a"),
                        name: "admin",
                        email: "admin.com",
                        password: hashedPassword,
                        role: ["admin"],
                        createdAt: new Date("2025-01-08T15:49:38.199Z"),
                        updatedAt: new Date("2025-01-08T15:49:38.199Z"),
                    },
                ];
                professors = [
                    {
                        _id: new mongodb_1.ObjectId(),
                        name: "Vitor",
                        email: "vitor@Unifesspa.edu.br",
                        password: hashedPassword,
                        role: ["professor", "course-coordinator"],
                        school: "Unifesspa",
                        students: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    {
                        _id: new mongodb_1.ObjectId(),
                        name: "Leia",
                        email: "leia@unifesspa.edu.br",
                        password: hashedPassword,
                        role: ["professor"],
                        school: "Unifesspa",
                        students: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    {
                        _id: new mongodb_1.ObjectId(),
                        name: "Alex",
                        email: "alex@Unifesspa.edu.br",
                        password: hashedPassword,
                        role: ["professor"],
                        school: "Unifesspa",
                        students: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ];
                professorsCollection = db.collection("Professor");
                _i = 0, professors_1 = professors;
                _b.label = 3;
            case 3:
                if (!(_i < professors_1.length)) return [3 /*break*/, 8];
                professor = professors_1[_i];
                return [4 /*yield*/, professorsCollection.findOne({ email: professor.email })];
            case 4:
                existingProfessor = _b.sent();
                if (!!existingProfessor) return [3 /*break*/, 6];
                return [4 /*yield*/, professorsCollection.insertOne(professor)];
            case 5:
                _b.sent();
                console.log("Professor ".concat(professor.name, " criado com sucesso"));
                return [3 /*break*/, 7];
            case 6:
                console.log("Professor ".concat(professor.name, " j\u00E1 existe"));
                _b.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 3];
            case 8:
                usersCollection = db.collection("User");
                _a = 0, users_1 = users;
                _b.label = 9;
            case 9:
                if (!(_a < users_1.length)) return [3 /*break*/, 14];
                user = users_1[_a];
                return [4 /*yield*/, usersCollection.findOne({ email: user.email })];
            case 10:
                existingUser = _b.sent();
                if (!!existingUser) return [3 /*break*/, 12];
                return [4 /*yield*/, usersCollection.insertOne(user)];
            case 11:
                _b.sent();
                console.log("Usu\u00E1rio ".concat(user.name, " criado com sucesso"));
                return [3 /*break*/, 13];
            case 12:
                console.log("Usu\u00E1rio ".concat(user.name, " j\u00E1 existe"));
                _b.label = 13;
            case 13:
                _a++;
                return [3 /*break*/, 9];
            case 14: return [4 /*yield*/, client.close()];
            case 15:
                _b.sent();
                console.log("Conexão com o MongoDB encerrada");
                return [3 /*break*/, 17];
            case 16:
                error_1 = _b.sent();
                console.error("Erro ao inicializar o banco de dados:", error_1.message);
                return [3 /*break*/, 17];
            case 17: return [2 /*return*/];
        }
    });
}); };
initializeDatabase();
