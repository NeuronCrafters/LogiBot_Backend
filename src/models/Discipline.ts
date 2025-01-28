import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDiscipline extends Document {
  name: string;
  course: Types.ObjectId;
  classes: Types.ObjectId[];
  professors: Types.ObjectId[];
  students: Types.ObjectId[];
}

const DisciplineSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Professor" }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
  }
);

DisciplineSchema.pre("findOneAndDelete", async function (next) {
  const discipline = await this.model.findOne(this.getFilter());
  if (discipline) {

    await mongoose.model("Course").findByIdAndUpdate(discipline.course, {
      $pull: { disciplines: discipline._id },
    });

    await mongoose.model("Professor").updateMany(
      { _id: { $in: discipline.professors } },
      { $pull: { disciplines: discipline._id } }
    );
  }
  next();
});

export const Discipline = mongoose.model<IDiscipline>("Discipline", DisciplineSchema);
