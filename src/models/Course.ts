import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICourse extends Document {
  name: string;
  university: Types.ObjectId;
  classes: Types.ObjectId[];
  professors: Types.ObjectId[];
  disciplines: Types.ObjectId[];
}

const CourseSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: "University", required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professor" }],
    disciplines: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discipline" }],
  },
  {
    timestamps: true,
  }
);

CourseSchema.pre("findOneAndDelete", async function (next) {
  const course = await this.model.findOne(this.getFilter());
  if (course) {
    await mongoose.model("University").findByIdAndUpdate(course.university, {
      $pull: { courses: course._id },
    });
  }
  next();
});

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
