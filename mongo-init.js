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
var MONGO_URI = process.env.MONGO_URI;
var DB_NAME = process.env.DB_NAME;
if (!MONGO_URI) {
    throw new Error("MONGO_URI não está definido. Verifique as variáveis de ambiente.");
}
var initializeDatabase = function () { return __awaiter(void 0, void 0, void 0, function () {
    var client, db, adminDb, dbUsers, _i, dbUsers_1, user, e_1, usersCollection, hashedPassword, users, existingUsers, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 14, , 15]);
                client = new mongodb_1.MongoClient(MONGO_URI);
                return [4 /*yield*/, client.connect()];
            case 1:
                _a.sent();
                console.log("Conectado ao MongoDB");
                db = client.db(DB_NAME);
                adminDb = client.db("admin");
                dbUsers = [
                    { user: "ramon", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
                    { user: "Igor", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
                    { user: "Alex", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
                    { user: "Wesley", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
                ];
                _i = 0, dbUsers_1 = dbUsers;
                _a.label = 2;
            case 2:
                if (!(_i < dbUsers_1.length)) return [3 /*break*/, 7];
                user = dbUsers_1[_i];
                _a.label = 3;
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4 /*yield*/, adminDb.command({
                        createUser: user.user,
                        pwd: user.pwd,
                        roles: user.roles,
                    })];
            case 4:
                _a.sent();
                console.log("Usu\u00E1rio ".concat(user.user, " criado com sucesso"));
                return [3 /*break*/, 6];
            case 5:
                e_1 = _a.sent();
                console.log("Usu\u00E1rio ".concat(user.user, " j\u00E1 existe ou ocorreu um erro:"), e_1.message);
                return [3 /*break*/, 6];
            case 6:
                _i++;
                return [3 /*break*/, 2];
            case 7:
                usersCollection = db.collection("users");
                return [4 /*yield*/, (0, bcryptjs_1.hash)("admin123", 10)];
            case 8:
                hashedPassword = _a.sent();
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
                return [4 /*yield*/, usersCollection.findOne({ email: "admin.com" })];
            case 9:
                existingUsers = _a.sent();
                if (!!existingUsers) return [3 /*break*/, 11];
                return [4 /*yield*/, usersCollection.insertMany(users)];
            case 10:
                _a.sent();
                console.log("Usuários iniciais inseridos com sucesso");
                return [3 /*break*/, 12];
            case 11:
                console.log("Usuário admin já existe na coleção");
                _a.label = 12;
            case 12: return [4 /*yield*/, client.close()];
            case 13:
                _a.sent();
                console.log("Conexão fechada");
                return [3 /*break*/, 15];
            case 14:
                error_1 = _a.sent();
                console.error("Erro ao inicializar o banco de dados:", error_1.message);
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/];
        }
    });
}); };
initializeDatabase();
