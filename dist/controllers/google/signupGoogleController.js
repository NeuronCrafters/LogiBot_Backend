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
exports.SignupGoogleController = void 0;
const signupGoogleService_1 = require("../../services/google/signupGoogleService");
class SignupGoogleController {
    constructor() {
        this.service = new signupGoogleService_1.SignupGoogleService();
    }
    handle(accessToken, refreshToken, profile, done) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { user, token } = yield this.service.create(profile);
                return done(null, { user, token });
            }
            catch (error) {
                console.error('Erro no controlador de cadastro com Google:', error);
                return done(error);
            }
        });
    }
}
exports.SignupGoogleController = SignupGoogleController;
