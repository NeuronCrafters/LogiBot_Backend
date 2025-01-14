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
exports.googleStrategy = void 0;
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = require("../../models/User");
const allowedDomains_1 = require("./allowedDomains");
const domainToSchoolMap = {
    'unifesspa.edu.br': 'Universidade Federal do Sul e Sudeste do Pará',
    'ufpa.com.br': 'Universidade Federal do Pará',
    'cin.ufpe.br': 'Centro de Informática da UFPE',
    'unb.br': 'Universidade de Brasília',
};
const googleStrategy = new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const email = (_b = (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value;
        if (!email) {
            return done(new Error('Email não encontrado no perfil do Google.'), null);
        }
        const emailDomain = email.split('@')[1];
        // Verifique se o domínio é permitido
        if (!allowedDomains_1.allowedDomains.includes(emailDomain)) {
            return done(new Error('Domínio do email não permitido.'), null);
        }
        // Mapeie o domínio para a escola
        const school = domainToSchoolMap[emailDomain];
        if (!school) {
            return done(new Error('Escola não mapeada para o domínio fornecido.'), null);
        }
        // Verifique se o usuário já existe
        let user = yield User_1.User.findOne({ googleId: profile.id });
        if (!user) {
            // Crie o novo usuário
            user = yield User_1.User.create({
                googleId: profile.id,
                name: profile.displayName,
                email,
                school, // Adicione a escola mapeada
                photo: ((_d = (_c = profile.photos) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) || null,
            });
        }
        return done(null, user);
    }
    catch (error) {
        console.error('Erro na autenticação com o Google:', error);
        return done(error);
    }
}));
exports.googleStrategy = googleStrategy;
