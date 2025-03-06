import { isAuthenticated } from "../isAuthenticated/isAuthenticated";
import { isAuthorized } from "../isAuthorized/isAuthorized";

class isPermissions {
  static isAdminOrCoordinator() {
    return [isAuthenticated, isAuthorized(["admin", "course-coordinator"])];
  }

  static isAdmin() {
    return [isAuthenticated, isAuthorized(["admin"])];
  }

  static isAuthenticated() {
    return [isAuthenticated];
  }

  static isAdminProfessorOrCoordinator() {
    return [isAuthenticated, isAuthorized(["admin", "professor", "course-coordinator"])];
  }
}

export { isPermissions };
