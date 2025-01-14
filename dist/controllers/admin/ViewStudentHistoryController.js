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
exports.ViewStudentHistoryController = void 0;
const ViewStudentHistoryService_1 = require("../../services/admin/ViewStudentHistoryService");
class ViewStudentHistoryController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { studentId } = req.params;
            const viewStudentHistoryService = new ViewStudentHistoryService_1.ViewStudentHistoryService();
            try {
                const history = yield viewStudentHistoryService.execute(studentId);
                return res.json(history);
            }
            catch (error) {
                return res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.ViewStudentHistoryController = ViewStudentHistoryController;
