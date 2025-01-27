import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: string[];
  school: Types.ObjectId;
  course: Types.ObjectId;
  class: Types.ObjectId;
  googleId?: string;
  photo?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    role: { type: [String], default: ["student"] },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    googleId: { type: String, required: false },
    photo: { type: String, required: false },
    resetPasswordToken: { type: String, required: false },
    resetPasswordExpires: { type: Date, required: false },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", UserSchema);
