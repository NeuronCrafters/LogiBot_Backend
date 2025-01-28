import mongoose, { Schema, Document, Types } from "mongoose";

export interface IClass extends Document {
  name: string;
  course: Types.ObjectId;
  students: Types.ObjectId[];
  disciplines: Types.ObjectId[];
}

const ClassSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    disciplines: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discipline" }],
  },
  {
    timestamps: true,
  }
);

ClassSchema.pre("findOneAndDelete", async function (next) {
  const classDoc = await this.model.findOne(this.getFilter());
  if (classDoc) {
    await mongoose.model("Course").findByIdAndUpdate(classDoc.course, {
      $pull: { classes: classDoc._id },
    });
  }
  next();
});

export const Class = mongoose.model<IClass>("Class", ClassSchema);
