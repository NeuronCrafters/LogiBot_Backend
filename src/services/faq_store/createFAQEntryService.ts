import { FAQStore } from "../../models/FAQStore";

export class CreateFAQEntryService {
  async execute(data: {
    group_id: string;
    subject: string;
    nivel: string;
    questions: any[];
    answer_keys: string[];
  }) {
    try {
      const faqEntry = new FAQStore(data);
      await faqEntry.save();
      return { message: "Gabarito salvo com sucesso!" };
    } catch (error) {
      throw new Error(`Erro ao salvar FAQ: ${error.message}`);
    }
  }
}
