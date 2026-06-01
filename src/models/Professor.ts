import { createSqlCompatModel } from "./sqlCompatModel";

export interface PasswordHistoryEntry {
  hash: string;
  changedAt: Date;
}

export interface IProfessor {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  password?: string;
  passwordHash?: string;
  previousPasswords?: PasswordHistoryEntry[];
  role: string[];
  school?: string;
  courses?: string[];
  classes?: string[];
  disciplines?: string[];
  students?: string[];
  status: "active" | "inactive";
  photo?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastFeedbackAt?: Date;
  save?: () => Promise<IProfessor>;
}

export const Professor = createSqlCompatModel("Professor");
