import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICourse extends Document {
  name: string;
  university: Types.ObjectId;
  classes: Types.ObjectId[];
}

const CourseSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
  },
  {
    timestamps: true,
  }
);

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
