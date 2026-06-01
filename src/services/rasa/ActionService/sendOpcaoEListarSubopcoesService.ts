import { getSubcategoryButtons } from "./localSaelData";

export async function sendOpcaoEListarSubopcoesService(categoria: string) {
  return {
    responses: [{ text: "Escolha um topico:", buttons: getSubcategoryButtons(categoria) }],
  };
}
