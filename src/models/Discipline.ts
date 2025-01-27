import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISubject extends Document {
  name: string; // Exemplo: "Estrutura de Dados"
  classes: Types.ObjectId[]; // Turmas onde a disciplina é ministrada
  professors: Types.ObjectId[]; // Professores responsáveis pela disciplina
}

const DisciplineSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professor" }],
  },
  {
    timestamps: true,
  }
);

export const Discipline = mongoose.model<ISubject>("Discipline", DisciplineSchema);
