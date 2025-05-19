import mongoose, { Document, Schema, Types } from "mongoose";

interface IQuestion {
    question: string;
    options: string[];
}

const QuestionSchema = new Schema<IQuestion>(
    {
        question: { type: String, required: true },
        options: {
            type: [String],
            required: true,
            validate: {
                validator: (arr: string[]) => arr.length === 5,
                message: "Cada conjunto de opções deve ter exatamente 5 itens."
            }
        }
    },
    { _id: false }
);

interface ILevelBlock {
    questions: IQuestion[];
    answer_keys: string[];
}
const LevelBlockSchema = new Schema<ILevelBlock>(
    {
        questions: {
            type: [QuestionSchema],
            required: true,
            validate: {
                validator: (arr: IQuestion[]) => arr.length === 5,
                message: "Cada nível deve ter exatamente 5 perguntas."
            }
        },
        answer_keys: {
            type: [String],
            required: true,
            validate: {
                validator: (arr: string[]) => arr.length === 5,
                message: "Cada nível deve ter exatamente 5 gabaritos."
            }
        }
    },
    { _id: false }
);

interface ISubsubjectBlock {
    name: string;
    levels: Map<string, ILevelBlock>;
}
const SubsubjectBlockSchema = new Schema<ISubsubjectBlock>(
    {
        name: { type: String, required: true },
        levels: {
            type: Map,
            of: LevelBlockSchema,
            default: {}
        }
    },
    { _id: false }
);

export interface IFaqStore extends Document {
    assunto: string;
    subassuntos: ISubsubjectBlock[];
    createdAt: Date;
    updatedAt: Date;
}

const FaqStoreSchema = new Schema<IFaqStore>(
    {
        assunto: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        subassuntos: {
            type: [SubsubjectBlockSchema],
            required: true,
            validate: {
                validator: (arr: ISubsubjectBlock[]) => arr.length > 0,
                message: "Deve haver pelo menos um subassunto."
            }
        }
    },
    {
        timestamps: true
    }
);

export const FaqStore = mongoose.model<IFaqStore>(
    "FaqStore",
    FaqStoreSchema
);
