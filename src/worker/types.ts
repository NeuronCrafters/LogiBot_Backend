import type { ObjectId } from "mongodb";

export type Role = "admin" | "student" | "professor" | "course-coordinator";

export interface Env {
  MONGO_URI: string;
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
  _id?: ObjectId;
  name: string;
  email: string;
  password?: string;
  previousPasswords?: PasswordHistoryEntry[];
  role: Role[];
  school?: ObjectId;
  status?: "active" | "inactive" | "graduated" | "dropped";
  photo?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastFeedbackAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StudentDocument extends BaseUserDocument {
  course?: ObjectId;
  class?: ObjectId;
  disciplines?: ObjectId[];
  level?: string;
}

export interface ProfessorDocument extends BaseUserDocument {
  courses?: ObjectId[];
  classes?: ObjectId[];
  disciplines?: ObjectId[];
  students?: ObjectId[];
}

export interface UniversityDocument {
  _id?: ObjectId;
  name: string;
  courses?: ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CourseDocument {
  _id?: ObjectId;
  name: string;
  university: ObjectId;
  classes?: ObjectId[];
  professors?: ObjectId[];
  disciplines?: ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClassDocument {
  _id?: ObjectId;
  name: string;
  course: ObjectId;
  students?: ObjectId[];
  disciplines?: ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DisciplineDocument {
  _id?: ObjectId;
  name: string;
  course: ObjectId;
  classes?: ObjectId[];
  professors?: ObjectId[];
  students?: ObjectId[];
  code: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserAnalysisDocument {
  _id?: ObjectId;
  userId: string;
  name: string;
  email: string;
  schoolId: ObjectId;
  schoolName: string;
  courseId: ObjectId;
  courseName: string;
  classId: ObjectId;
  className: string;
  totalUsageTime?: number;
  sessions?: Array<Record<string, unknown>>;
}
