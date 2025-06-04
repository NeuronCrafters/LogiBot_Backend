"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPermissions = void 0;
const isAuthenticated_1 = require("../isAuthenticated/isAuthenticated");
const isAuthorized_1 = require("../isAuthorized/isAuthorized");
class isPermissions {
    static isAdminOrCoordinator() {
        return [isAuthenticated_1.isAuthenticated, (0, isAuthorized_1.isAuthorized)(["admin", "course-coordinator"])];
    }
    static isAdmin() {
        return [isAuthenticated_1.isAuthenticated, (0, isAuthorized_1.isAuthorized)(["admin"])];
    }
    static isAuthenticated() {
        return [isAuthenticated_1.isAuthenticated];
    }
    static isAdminProfessorOrCoordinator() {
        return [isAuthenticated_1.isAuthenticated, (0, isAuthorized_1.isAuthorized)(["admin", "professor", "course-coordinator"])];
    }
}
exports.isPermissions = isPermissions;
