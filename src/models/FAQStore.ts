import mongoose, { Document, Schema } from "mongoose";

export interface IQuestion {
    question: string;
    options: string[];
}

const QuestionSchema = new Schema<IQuestion>({
    question: { type: String, required: true },
    options: {
        type: [String],
        validate: {
            validator: (arr: string[]) => Array.isArray(arr) && arr.length === 5,
            message: 'Options deve ter exatamente 5 elementos'
        },
        required: true
    }
}, { _id: false });

export interface ILevelBlock {
    questions: IQuestion[];
    answer_keys: string[];
}

const LevelBlockSchema = new Schema<ILevelBlock>({
    questions: {
        type: [QuestionSchema],
        validate: {
            validator: (arr: IQuestion[]) => Array.isArray(arr) && arr.length === 5,
            message: 'Questions deve ter exatamente 5 elementos'
        },
        required: true
    },
    answer_keys: {
        type: [String],
        validate: {
            validator: (arr: string[]) => Array.isArray(arr) && arr.length === 5,
            message: 'Answer_keys deve ter exatamente 5 elementos'
        },
        required: true
    }
}, { _id: false });

export interface ISubsubject {
    name: string;
    levels: {
        basico: ILevelBlock[];
        intermediario: ILevelBlock[];
        avancado: ILevelBlock[];
    };
}

const SubsubjectSchema = new Schema<ISubsubject>(
    {
        name: { type: String, required: true },
        levels: {
            basico: { type: [LevelBlockSchema], default: [] },
            intermediario: { type: [LevelBlockSchema], default: [] },
            avancado: { type: [LevelBlockSchema], default: [] }
        }
    },
    {
        _id: false,
        toJSON: { transform: (_, ret) => ({ name: ret.name, levels: ret.levels }) },
        toObject: { transform: (_, ret) => ({ name: ret.name, levels: ret.levels }) }
    }
);

export interface IFaqStore extends Document {
    assunto: string;
    subassuntos: ISubsubject[];
    createdAt: Date;
    updatedAt: Date;
}

const FaqStoreSchema = new Schema<IFaqStore>({
    assunto: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    subassuntos: {
        type: [SubsubjectSchema],
        default: []
    }
}, { timestamps: true });

// Interface para o modelo
export interface IFaqStoreModel extends mongoose.Model<IFaqStore> {
    getOrCreate(assunto: string): Promise<IFaqStore>;
}

// Método estático para obter ou criar um FaqStore
FaqStoreSchema.statics.getOrCreate = async function (assunto: string) {
    let doc = await this.findOne({ assunto });
    if (!doc) {
        throw new Error(`Assunto "${assunto}" não inicializado. Execute o script inicializador.`);
    }
    return doc;
};

// Criação do modelo
export const FaqStore = mongoose.model<IFaqStore, IFaqStoreModel>(
    "FaqStore",
    FaqStoreSchema
);

// Função para remover índices problemáticos
export async function cleanupIndexes() {
    try {
        const indexes = await mongoose.connection.collection('faqstores').indexes();
        console.log('Índices existentes:', indexes.map(idx => idx.name));

        const problematicIndex = indexes.find(idx =>
            idx.name && idx.name.includes('assuntos.subassuntos.niveis.questions.question')
        );

        if (problematicIndex) {
            await mongoose.connection.collection('faqstores').dropIndex(problematicIndex.name);
            console.log(`Índice problemático ${problematicIndex.name} removido com sucesso.`);
        }
    } catch (error) {
        console.log('Erro ao limpar índices:', error.message);
    }
}
