import { Model } from "mongoose";
import { User, IUser } from "../models/User";
import { Professor, IProfessor } from "../models/Professor";

type AccountModel = Model<IUser> | Model<IProfessor>;

export function getUserModelByRole(role: string | string[]): AccountModel {
  const mainRole = Array.isArray(role) ? role[0] : role;

  if (["professor", "course-coordinator"].includes(mainRole)) {
    return Professor as unknown as AccountModel;
  }

  return User as unknown as AccountModel;
}