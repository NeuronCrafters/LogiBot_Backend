import { getLevelButtons } from "./localSaelData";

export async function listarNiveisService() {
  return {
    responses: [{ text: "Escolha um nivel:", buttons: getLevelButtons() }],
  };
}
