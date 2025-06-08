export function hasRole(userRoles: string[], role: string): boolean {
  return userRoles.includes(role);
}

export function isAdmin(userRoles: string[]): boolean {
  return hasRole(userRoles, "admin");
}

export function isCourseCoordinator(userRoles: string[]): boolean {
  return hasRole(userRoles, "course-coordinator");
}

export function isProfessor(userRoles: string[]): boolean {
  return hasRole(userRoles, "professor");
}
