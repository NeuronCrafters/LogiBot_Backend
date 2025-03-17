import mongoose, { Document, Schema } from "mongoose";

interface IUserAnalysis extends Document {
  userId: string;
  name: string;
  email: string;
  school: string;
  courses: string;
  classes: string;
  sessions: {
    sessionStart: Date;
    sessionEnd?: Date;
    sessionDuration?: number;
    interactions: {
      timestamp: Date;
      message: string;
      botResponse?: string
    }[];
    answerHistory: {
      questions: {
        level: string;
        subject: string;
        selectedOption: {
          question: string;
          isCorrect: string;
          isSelected: string;
        }[];
        totalCorrectAnswers: number;
        totalWrongAnswers: number;
        timestamp: Date;
      }[];
    }[];
  }[];
  interactionsOutsideTheClassroom: {
    timestamp: Date;
    message: string;
  }[];
}[];


const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  school: { type: String, required: true },
  courses: { type: String, required: true },
  classes: { type: String, required: true },
  sessions: [
    {
      sessionStart: { type: Date, required: true, default: Date.now },
      sessionEnd: { type: Date },
      sessionDuration: { type: Number, default: 0 },
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
              level: { type: String },
              subject: { type: String, required: true },
              selectedOption: [
                {
                  question: { type: String, required: true },
                  isCorrect: { type: String, required: true },
                  isSelected: { type: String, required: true },
                },
              ],
              totalCorrectAnswers: { type: Number, default: 0 },
              totalWrongAnswers: { type: Number, default: 0 },
              timestamp: { type: Date, default: Date.now },
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

// calculo da duração da sessão antes de salvar
UserAnalysisSchema.pre("save", function (next) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];
    if (lastSession.sessionEnd && lastSession.sessionStart) {
      lastSession.sessionDuration = (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
    }
  }
  next();
});

// método para adicionar interações dentro da sessão ativa
UserAnalysisSchema.methods.addInteraction = function (message: string, botResponse?: string) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];

    if (!lastSession.sessionEnd) {
      // atualiza a última interação se já houver interações
      if (lastSession.interactions.length > 0) {
        lastSession.interactions[lastSession.interactions.length - 1] = {
          timestamp: new Date(),
          message,
          botResponse: botResponse || "",
        };
      } else {
        lastSession.interactions.push({
          timestamp: new Date(),
          message,
          botResponse: botResponse || "",
        });
      }
    } else {
      console.warn("A sessão foi encerrada. Não é possível adicionar novas interações.");
    }
  } else {
    console.warn("Nenhuma sessão ativa encontrada. Interação não registrada.");
  }
};

// método para adicionar histórico de respostas dentro da sessão ativa
UserAnalysisSchema.methods.addAnswerHistory = function (question_id: string, selectedOption: string, isCorrect: boolean) {
  if (this.sessions.length > 0) {
    const lastSession = this.sessions[this.sessions.length - 1];

    if (!lastSession.sessionEnd) {
      lastSession.answerHistory.push({
        question_id,
        selectedOption,
        isCorrect,
        timestamp: new Date(),
      });
    } else {
      console.warn("A sessão foi encerrada. Não é possível adicionar respostas.");
    }
  } else {
    console.warn("Nenhuma sessão ativa encontrada. Resposta não registrada.");
  }
};

// método para adicionar interações fora da sala de aula dentro da sessão ativa
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
