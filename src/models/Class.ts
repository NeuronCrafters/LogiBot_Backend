import mongoose, { Schema, Document, Types } from "mongoose";

export interface IClass extends Document {
  name: string; // Exemplo: "2021"
  course: Types.ObjectId; // Curso ao qual a turma pertence
  students: Types.ObjectId[]; // Alunos na turma
  subjects: Types.ObjectId[]; // Disciplinas ministradas na turma
}

const ClassSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
  },
  {
    timestamps: true,
  }
);

export const Class = mongoose.model<IClass>("Class", ClassSchema);
