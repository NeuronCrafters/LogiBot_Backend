import mongoose, { Document, Schema } from "mongoose";

interface IUserAnalysis extends Document {
  userId: string;
  startTime: Date;
  endTime?: Date;
  totalTime?: number;
  outOfScopeQuestions: number;
  taxaDeAcertos: number;
  interacoesForaDaSala?: { timestamp: Date }[];
  dispositivo?: string;
  interactions: { timestamp: Date; message: string }[];
}

const UserAnalysisSchema = new Schema<IUserAnalysis>({
  userId: { type: String, required: true, index: true },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  totalTime: { type: Number, default: 0 },

  outOfScopeQuestions: { type: Number, default: 0 },
  taxaDeAcertos: { type: Number, default: 0 },

  interacoesForaDaSala: { type: [{ timestamp: { type: Date } }], default: [] },
  interactions: [{ timestamp: { type: Date }, message: { type: String } }],

  dispositivo: { type: String, default: "desconhecido" },
});

// metodo para calcular o tempo total automaticamente antes de salvar
UserAnalysisSchema.pre("save", function (next) {
  if (this.endTime) {
    this.totalTime = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
  }
  next();
});

const UserAnalysis = mongoose.model<IUserAnalysis>("UserAnalysis", UserAnalysisSchema);
export { UserAnalysis, IUserAnalysis };
