import { getCategoryButtons } from "./localSaelData";

export async function listarOpcoesService() {
  return {
    responses: [{ text: "Escolha um assunto:", buttons: getCategoryButtons() }],
  };
}
