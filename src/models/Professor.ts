import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User";

export interface IProfessor extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  students: IUser[];
  school: string;
}

const ProfessorSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "professor" },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    school: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const Professor = mongoose.model<IProfessor>("Professor", ProfessorSchema);
