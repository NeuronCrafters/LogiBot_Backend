import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProfessor extends Document {
  name: string;
  email: string;
  password?: string;
  role: string[];
  school: Types.ObjectId; // Universidade
  courses: Types.ObjectId[]; // Cursos que o professor leciona
  subjects: Types.ObjectId[]; // Disciplinas ministradas
  googleId?: string;
  photo?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
}

const ProfessorSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: [String], enum: ["professor", "course-coordinator"], default: ["professor"] },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    googleId: { type: String, required: false },
    photo: { type: String, required: false },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },
  },
  {
    timestamps: true,
  }
);

ProfessorSchema.pre<IProfessor>("save", function (next) {
  if (!Array.isArray(this.role)) {
    this.role = [this.role];
  }
  if (!this.role.includes("professor")) {
    this.role.push("professor");
  }
  next();
});

export const Professor = mongoose.model<IProfessor>("Professor", ProfessorSchema);
