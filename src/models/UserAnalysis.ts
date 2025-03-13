import mongoose, { Document, Schema } from "mongoose";

interface IUserAnalysis extends Document {
  userId: string;
  name: string;
  email: string;
  sessions: {
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
  }[];
  devices: {
    deviceType: string;
    os: string;
    browser: string;
    timestamp: Date;
  }[];
  levels: {
    level: string;
    timestamp: Date;
  }[];
  interactionsOutsideTheClassroom: {
    timestamp: Date;
    message: string;
  }[];
  school: string;
  courses: string;
  classes: string;
  interactions: { timestamp: Date; message: string; botResponse?: string }[];
  answerHistory: {
    question_id: string;
    selectedOption: string;
    isCorrect: boolean;
    timestamp: Date;
  }[];
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  sessions: [
    {
      sessionStart: { type: Date, required: true, default: Date.now },
      sessionEnd: { type: Date },
      sessionDuration: { type: Number, default: 0 },
    },
  ],
  devices: [
    {
      deviceType: { type: String, required: true },
      os: { type: String, required: true },
      browser: { type: String, required: true },
      timestamp: { type: Date, required: true, default: Date.now },
    },
  ],
  levels: [
    {
      level: { type: String, required: true },
      timestamp: { type: Date, required: true, default: Date.now },
    },
  ],
  interactionsOutsideTheClassroom: [
    {
      timestamp: { type: Date, required: true, default: Date.now },
      message: { type: String, required: true },
    },
  ],
  school: { type: String, required: true },
  courses: { type: String, required: true },
  classes: { type: String, required: true },
  interactions: [
    { timestamp: { type: Date }, message: { type: String }, botResponse: { type: String, default: "" } }
  ],
  answerHistory: [
    {
      question_id: { type: String, required: true },
      selectedOption: { type: String, required: true },
      isCorrect: { type: Boolean, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

UserAnalysisSchema.pre("save", function (next) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (lastSession.sessionEnd && lastSession.sessionStart) {
      lastSession.sessionDuration = (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
    }
  }
  next();
});

const UserAnalysis = mongoose.model<IUserAnalysis>("UserAnalysis", UserAnalysisSchema);
export { UserAnalysis, IUserAnalysis };
