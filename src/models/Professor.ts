import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProfessor extends Document {
  name: string;
  email: string;
  password?: string;
  role: "professor";
  school: string;
  students: Types.ObjectId[];
}

const ProfessorSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["professor"], default: "professor" },
    school: { type: String, required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
  }
);

export const Professor = mongoose.model<IProfessor>("Professor", ProfessorSchema);
