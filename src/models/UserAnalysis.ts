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
  sessions: {
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    interactions: {
      timestamp: Date;
      message: string;
      botResponse?: string;
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
    }[];
    interactionsOutsideTheClassroom: {
      timestamp: Date;
      message: string;
    }[];
  }[];
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
  sessions: [
    {
      sessionStart: { type: Date, required: true, default: Date.now },
      sessionEnd: { type: Date },
      sessionDuration: { type: Number, default: 0 },
      totalCorrectAnswers: { type: Number, default: 0 },
      totalWrongAnswers: { type: Number, default: 0 },
      interactions: [
        {
          timestamp: { type: Date, required: true, default: Date.now },
          message: { type: String, required: true },
          botResponse: { type: String, default: "" },
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
        },
      ],
      interactionsOutsideTheClassroom: [
        {
          timestamp: { type: Date, required: true, default: Date.now },
          message: { type: String, required: true },
        },
      ],
    },
  ],
});


// metodo para calcular a duração da sessão antes de salvar
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

// metodo de pré‑validação para corrigir possíveis dados ausentes em answerHistory
UserAnalysisSchema.pre("validate", function (next) {
  this.sessions.forEach((session: any) => {
    if (session.answerHistory && Array.isArray(session.answerHistory)) {
      session.answerHistory = session.answerHistory.map((ah: any) => {
        if (ah.questions && Array.isArray(ah.questions)) {
          ah.questions = ah.questions.map((q: any) => {
            return {
              level: q.level || "Nível desconhecido",
              subject: q.subject || "Assunto desconhecido",
              selectedOption: {
                question: (q.selectedOption && q.selectedOption.question) || "N/A",
                isCorrect: (q.selectedOption && q.selectedOption.isCorrect) || "false",
                isSelected: (q.selectedOption && q.selectedOption.isSelected) || "false",
              },
              totalCorrectAnswers: q.totalCorrectAnswers || 0,
              totalWrongAnswers: q.totalWrongAnswers || 0,
              timestamp: q.timestamp || new Date(),
            };
          });
        }
        return ah;
      });
    }
  });
  next();
});

// metodo para adicionar interações e answerHistory 
UserAnalysisSchema.methods.addInteraction = function (message: string, botResponse?: string) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (!lastSession.sessionEnd) {
      lastSession.interactions.push({
        timestamp: new Date(),
        message,
        botResponse: botResponse || "",
      });
    } else {
      console.warn("A sessão foi encerrada. Não é possível adicionar novas interações.");
    }
  } else {
    console.warn("Nenhuma sessão ativa encontrada. Interação não registrada.");
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
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
            timestamp: new Date(),
          },
        ],
      });
    } else {
      console.warn("A sessão foi encerrada. Não é possível adicionar respostas.");
    }
  } else {
    console.warn("Nenhuma sessão ativa encontrada. Resposta não registrada.");
  }
};

UserAnalysisSchema.methods.addInteractionOutsideClassroom = function (message: string) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (!lastSession.sessionEnd) {
      lastSession.interactionsOutsideTheClassroom.push({
        timestamp: new Date(),
        message,
      });
    } else {
      console.warn("A sessão foi encerrada. Não é possível adicionar interações fora da sala de aula.");
    }
  } else {
    console.warn("Nenhuma sessão ativa encontrada. Interação fora da sala de aula não registrada.");
  }
};

const UserAnalysis = mongoose.model<IUserAnalysis>("UserAnalysis", UserAnalysisSchema);

export { UserAnalysis, IUserAnalysis };
