import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User";

export interface IHistory extends Document {
  student: IUser;
  content: string;
  date: Date;
}

const HistorySchema: Schema = new Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const History = mongoose.model<IHistory>("History", HistorySchema);
