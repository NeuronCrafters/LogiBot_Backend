import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User";

export interface IHistory extends Document {
  student: IUser;
  messages: { sender: string; text: string }[];
  metadata: Record<string, any>;
  startTime: Date;
  endTime: Date;
}

const HistorySchema: Schema = new Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: [
      {
        sender: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    metadata: { type: Schema.Types.Mixed },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

export const History = mongoose.model<IHistory>("History", HistorySchema);
