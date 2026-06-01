export type Role = "admin" | "student" | "professor" | "course-coordinator";

export interface Env {
  DATABASE_URL?: string;
  JWT_SECRET: string;
  API_KEY?: string;
  FRONT_URL?: string;
  COOKIE_DOMAIN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AUTH_TOKEN?: string;
  CLOUDFLARE_AI_MODEL?: string;
  AI?: unknown;
  NODE_ENV?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role[];
  school?: string | null;
  courses?: string[] | string | null;
  classes?: string[] | string | null;
}

export interface AppVariables {
  requestId: string;
  user?: AuthUser;
}

export type AppBindings = {
  Bindings: Env;
  Variables: AppVariables;
};

export interface PasswordHistoryEntry {
  hash: string;
  changedAt: Date;
}

export interface BaseUserDocument {
  id: string;
  name: string;
  email: string;
  password?: string | null;
  previousPasswords?: PasswordHistoryEntry[];
  role: Role[];
  school?: string | null;
  status?: "active" | "inactive" | "graduated" | "dropped";
  photo?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastFeedbackAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StudentDocument extends BaseUserDocument {
  course?: string | null;
  class?: string | null;
  disciplines?: string[];
  level?: string;
}

export interface ProfessorDocument extends BaseUserDocument {
  courses?: string[];
  classes?: string[];
  disciplines?: string[];
  students?: string[];
}

export interface UniversityDocument {
  id: string;
  name: string;
  courses?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CourseDocument {
  id: string;
  name: string;
  university: string;
  classes?: string[];
  professors?: string[];
  disciplines?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClassDocument {
  id: string;
  name: string;
  course: string;
  students?: string[];
  disciplines?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DisciplineDocument {
  id: string;
  name: string;
  course: string;
  classes?: string[];
  professors?: string[];
  students?: string[];
  code: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserAnalysisDocument {
  id: string;
  userId: string;
  name: string;
  email: string;
  schoolId: string;
  schoolName: string;
  courseId: string;
  courseName: string;
  classId: string;
  className: string;
  totalUsageTime?: number;
  sessions?: Array<Record<string, unknown>>;
}
