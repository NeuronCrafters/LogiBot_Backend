import { FAQStore } from "../../models/FAQStore";

export class GetFAQEntriesService {
  async execute() {
    try {
      return await FAQStore.find();
    } catch (error) {
      throw new Error(`Erro ao buscar FAQs: ${error.message}`);
    }
  }
}
