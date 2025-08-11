import mongoose, { Schema, Document, Types } from "mongoose";

/* ---------- Subdocumento para histórico de senhas ---------- */
export interface PasswordHistoryEntry {
    hash: string;
    changedAt: Date;
}

const passwordHistorySchema = new Schema<PasswordHistoryEntry>(
    {
        hash: { type: String, required: true },
        changedAt: { type: Date, required: true },
    },
    { _id: false }
);

/* ---------- Interface principal ---------- */
export interface IProfessor extends Document {
    name: string;
    email: string;
    password?: string;
    previousPasswords: PasswordHistoryEntry[];
    role: string[];
    school: Types.ObjectId;
    courses: Types.ObjectId[];
    classes: Types.ObjectId[];
    disciplines: Types.ObjectId[];
    students: Types.ObjectId[];
    status: "active" | "inactive";
    googleId?: string;
    photo?: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
}

/* ---------- Schema principal ---------- */
const ProfessorSchema: Schema = new Schema<IProfessor>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true, select: false },
        previousPasswords: {
            type: [passwordHistorySchema],
            default: [],
            select: false,
        },
        role: {
            type: [String],
            enum: ["professor", "course-coordinator"],
            default: ["professor"],
        },
        school: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
        classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
        courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
        disciplines: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discipline" }],
        students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        googleId: { type: String },
        photo: { type: String },
        resetPasswordToken: { type: String },
        resetPasswordExpires: { type: Date },
    },
    {
        timestamps: true,
    }
);

/* ---------- Hook de limpeza ao deletar professor ---------- */
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
