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
exports.passport = void 0;
const passport_1 = __importDefault(require("passport"));
exports.passport = passport_1.default;
const googleStrategy_1 = require("./googleStrategy");
const googleLoginStrategy_1 = require("./googleLoginStrategy");
const User_1 = require("../../models/User");
// Loga um usuário no sistema Google
passport_1.default.use('google-login', googleLoginStrategy_1.googleLoginStrategy);
// Registra um usuário no sistema via Google
passport_1.default.use('google-signup', googleStrategy_1.googleStrategy);
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.User.findById(id);
        if (!user) {
            return done(new Error('Usuário não encontrado durante a deserialização.'), null);
        }
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
}));
