import { createSqlCompatModel } from "./sqlCompatModel";

export interface PasswordHistoryEntry {
  hash: string;
  changedAt: Date;
}

export interface IUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  password?: string;
  passwordHash?: string;
  previousPasswords?: PasswordHistoryEntry[];
  role: string[];
  school?: string;
  course?: string;
  class?: string;
  disciplines?: string[];
  level?: string;
  status: "active" | "inactive" | "graduated" | "dropped";
  photo?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastFeedbackAt?: Date;
  save?: () => Promise<IUser>;
}

export const User = createSqlCompatModel("User");
