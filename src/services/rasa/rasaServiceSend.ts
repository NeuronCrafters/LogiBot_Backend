import axios from "axios";

const RASA_URL = "http://localhost:5005/webhooks/rest/webhook";

function rasaServiceSend(message: string, sender: string) {
  if (!sender) {
    throw new Error("Sender (usuário) não pode ser indefinido.");
  }

  return axios
    .post(RASA_URL, { sender, message })
    .then(response => response.data)
    .catch(error => {
      console.error("Erro ao conectar ao Rasa:", error);
      throw new Error("Falha ao se comunicar com o Rasa.");
    });
}

export { rasaServiceSend };
