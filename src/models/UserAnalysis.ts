import mongoose, { Document, Schema } from "mongoose";

interface IUserAnalysis extends Document {
  userId: string;
  name: string;
  email: string;
  school: string;
  courses: string;
  classes: string;
  totalUsageTime: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  subjectFrequencyGlobal?: Record<string, number>;
  sessions: {
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    subjectFrequency?: Record<string, number>;
    interactions: {
      timestamp: Date;
      message: string;
      botResponse?: string;
      subjectMatched?: string | null;
    }[];
    answerHistory: {
      questions: {
        level: string;
        subject: string;
        selectedOption: {
          question: string;
          isCorrect: string;
          isSelected: string;
        };
        totalCorrectAnswers: number;
        totalWrongAnswers: number;
        timestamp: Date;
      }[];
      subjectCorrectCount?: Record<string, number>;
      subjectWrongCount?: Record<string, number>;
    }[];
    sessionBot: {
      mostAccessedSubject?: {
        subject: string | null;
        count: number;
      };
      leastAccessedSubject?: {
        subject: string | null;
        count: number;
      };
      subjectFrequency?: Record<string, number>;
    }[];
  }[];

  addInteraction: (message: string, botResponse?: string, subjectMatched?: string | null) => void;
  addAnswerHistory: (
      question: string,
      selectedOption: string,
      isCorrect: string,
      level: string,
      subject: string
  ) => void;
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  school: { type: String, required: true },
  courses: { type: String, required: true },
  classes: { type: String, required: true },
  totalUsageTime: { type: Number, default: 0 },
  totalCorrectAnswers: { type: Number, default: 0 },
  totalWrongAnswers: { type: Number, default: 0 },
  subjectFrequencyGlobal: { type: Schema.Types.Mixed, default: {} },
  sessions: [
    {
      sessionStart: { type: Date, required: true, default: Date.now },
      sessionEnd: { type: Date },
      sessionDuration: { type: Number, default: 0 },
      totalCorrectAnswers: { type: Number, default: 0 },
      totalWrongAnswers: { type: Number, default: 0 },
      subjectFrequency: { type: Schema.Types.Mixed, default: {} },
      interactions: [
        {
          timestamp: { type: Date, required: true, default: Date.now },
          message: { type: String, required: true },
          botResponse: { type: String, default: "" },
          subjectMatched: { type: String, default: null },
        },
      ],
      answerHistory: [
        {
          questions: [
            {
              level: { type: String, required: true },
              subject: { type: String, required: true },
              selectedOption: {
                question: { type: String, required: true },
                isCorrect: { type: String, required: true },
                isSelected: { type: String, required: true },
              },
              totalCorrectAnswers: { type: Number, default: 0 },
              totalWrongAnswers: { type: Number, default: 0 },
              timestamp: { type: Date, required: true, default: Date.now },
            },
          ],
          subjectCorrectCount: { type: Schema.Types.Mixed, default: {} },
          subjectWrongCount: { type: Schema.Types.Mixed, default: {} },
        },
      ],
      sessionBot: {
        type: [
          {
            mostAccessedSubject: {
              subject: { type: String, default: null },
              count: { type: Number, default: 0 },
            },
            leastAccessedSubject: {
              subject: { type: String, default: null },
              count: { type: Number, default: 0 },
            },
            subjectFrequency: { type: Schema.Types.Mixed, default: {} },
          },
        ],
        default: [],
      },
    },
  ],
});

UserAnalysisSchema.pre("save", function (next) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (lastSession.sessionEnd && lastSession.sessionStart) {
      lastSession.sessionDuration =
          (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
    }
  }
  next();
});

UserAnalysisSchema.methods.addInteraction = function (
    message: string,
    botResponse?: string,
    subjectMatched: string | null = null
) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (!lastSession.sessionEnd) {
      const isUserMessage = !botResponse || botResponse.trim() === "";

      if (isUserMessage) {
        lastSession.interactions.push({
          timestamp: new Date(),
          message,
          botResponse: botResponse || "",
          subjectMatched,
        });

        if (subjectMatched) {
          // GLOBAL frequency
          if (!this.subjectFrequencyGlobal) this.subjectFrequencyGlobal = {};
          this.subjectFrequencyGlobal[subjectMatched] =
              (this.subjectFrequencyGlobal[subjectMatched] || 0) + 1;

          // SESSION frequency
          if (!lastSession.sessionBot || lastSession.sessionBot.length === 0) {
            lastSession.sessionBot = [
              {
                subjectFrequency: {},
                mostAccessedSubject: { subject: null, count: 0 },
                leastAccessedSubject: { subject: null, count: 0 },
              },
            ];
          }

          if (!lastSession.sessionBot[0].subjectFrequency) {
            lastSession.sessionBot[0].subjectFrequency = {};
          }

          const freq = lastSession.sessionBot[0].subjectFrequency;
          freq[subjectMatched] = (freq[subjectMatched] || 0) + 1;

          const sorted = Object.entries(freq).sort((a, b) => Number(b[1]) - Number(a[1]));

          lastSession.sessionBot[0].mostAccessedSubject = {
            subject: typeof sorted[0]?.[0] === "string" ? sorted[0][0] : null,
            count: typeof sorted[0]?.[1] === "number" ? sorted[0][1] : Number(sorted[0]?.[1]) || 0,
          };

          const last = sorted.at(-1);
          lastSession.sessionBot[0].leastAccessedSubject = {
            subject: typeof last?.[0] === "string" ? last[0] : null,
            count: typeof last?.[1] === "number" ? last[1] : Number(last?.[1]) || 0,
          };
        }
      }
    }
  }
};

UserAnalysisSchema.methods.addAnswerHistory = function (
    question: string,
    selectedOption: string,
    isCorrect: string,
    level: string,
    subject: string
) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (!lastSession.sessionEnd) {
      lastSession.answerHistory.push({
        questions: [
          {
            level: level || "Nível desconhecido",
            subject: subject || "Assunto desconhecido",
            selectedOption: {
              question: question || "N/A",
              isCorrect: isCorrect || "false",
              isSelected: selectedOption || "false",
            },
            totalCorrectAnswers: isCorrect === "true" ? 1 : 0,
            totalWrongAnswers: isCorrect === "false" ? 1 : 0,
            timestamp: new Date(),
          },
        ],
      });
    }
  }
};

const UserAnalysis = mongoose.model<IUserAnalysis>("UserAnalysis", UserAnalysisSchema);
export { UserAnalysis, IUserAnalysis };
