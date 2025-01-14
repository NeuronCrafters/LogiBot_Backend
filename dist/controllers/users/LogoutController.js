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
exports.LogoutController = void 0;
const LogoutUserService_1 = require("../../services/users/LogoutUserService");
class LogoutController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const logoutService = new LogoutUserService_1.LogoutService();
            try {
                const result = yield logoutService.logout();
                return res.json(result);
            }
            catch (error) {
                return res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.LogoutController = LogoutController;
