import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDiscipline extends Document {
  name: string; // Nome da disciplina (ex.: "Estrutura de Dados")
  classes: Types.ObjectId[]; // Turmas onde a disciplina é ministrada
  professors: Types.ObjectId[]; // Professores responsáveis pela disciplina
  students: Types.ObjectId[]; // Alunos associados à disciplina
}

const DisciplineSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professor" }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
  }
);

export const Discipline = mongoose.model<IDiscipline>("Discipline", DisciplineSchema);
