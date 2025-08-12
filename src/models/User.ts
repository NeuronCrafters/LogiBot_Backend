import mongoose, { Schema, Document, Types } from "mongoose";

/* ---------- Subdocumento ---------- */
export interface PasswordHistoryEntry {
    hash: string;
    changedAt: Date;
}

const historySubSchema = new Schema<PasswordHistoryEntry>(
    {
        hash: { type: String, required: true },
        changedAt: { type: Date, required: true },
    },
    { _id: false }
);

/* ---------- Interface principal ---------- */
export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    previousPasswords: PasswordHistoryEntry[];
    role: string[];
    school: Types.ObjectId;
    course: Types.ObjectId;
    class: Types.ObjectId;
    disciplines: Types.ObjectId[];
    level?: string;
    status: "active" | "inactive";
    googleId?: string;
    photo?: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
}

/* ---------- Schema principal ---------- */
const UserSchema: Schema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: false, select: false },
        previousPasswords: {
            type: [historySubSchema],
            default: [],
            select: false,
        },
        role: { type: [String], default: ["student"] },
        school: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
        disciplines: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discipline" }],
        level: { type: String, default: "desconhecido" },
        status: {
            type: String,
            enum: ["active", "inactive", "graduated", "dropped"],
            default: "active",
        },
        googleId: { type: String },
        photo: { type: String },
        resetPasswordToken: { type: String },
        resetPasswordExpires: { type: Date },
    },
    { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
