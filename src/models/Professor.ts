import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProfessor extends Document {
  name: string;
  email: string;
  password?: string;
  role: string[];
  school: Types.ObjectId;
  courses: Types.ObjectId[];
  disciplines: Types.ObjectId[];
  students: Types.ObjectId[];
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
    disciplines: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discipline" }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    googleId: { type: String, required: false },
    photo: { type: String, required: false },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },
  },
  {
    timestamps: true,
  }
);

ProfessorSchema.pre("findOneAndDelete", async function (next) {
  const professor = await this.model.findOne(this.getFilter());
  if (professor) {

    await mongoose.model("Course").updateMany(
      { _id: { $in: professor.courses } },
      { $pull: { professors: professor._id } }
    );

    await mongoose.model("Discipline").updateMany(
      { professors: professor._id },
      { $pull: { professors: professor._id } }
    );
  }
  next();
});

export const Professor = mongoose.model<IProfessor>("Professor", ProfessorSchema);
