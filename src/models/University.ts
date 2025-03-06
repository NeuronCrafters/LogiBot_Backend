import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUniversity extends Document {
  name: string;
  courses: Types.ObjectId[];
}

const UniversitySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  {
    timestamps: true,
  }
);

export const University = mongoose.model<IUniversity>("University", UniversitySchema);
