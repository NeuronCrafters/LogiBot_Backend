import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { parseQuestionsFromTextService } from "./parseQuestionsFromTextService";
import { FaqStore } from "models/FAQStore";
import { RasaSessionData } from "../types/RasaSessionData";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

export async function gerarPerguntasService(
    pergunta: string,
    session: RasaSessionData
) {
  // valida nível
  if (!session.nivelAtual) {
    throw new AppError(
        "O nível do usuário precisa ser definido antes de gerar perguntas.",
        400
    );
  }
  session.lastSubject = pergunta;

  // chama o Rasa
  let response;
  try {
    response = await axios.post(RASA_ACTION_URL, {
      next_action: "action_gerar_perguntas_chatgpt",
      tracker: {
        sender_id: "user",
        slots: {
          subtopico: pergunta,
          nivel: session.nivelAtual,
        },
      },
    });
  } catch (err: any) {
    console.error("✖️ gerarPerguntasService > chamada ao Rasa falhou:", err);
    throw new AppError("Erro ao gerar perguntas no Rasa", 500);
  }

  const rawText = response.data?.responses?.[0]?.text;
  if (!rawText) {
    throw new AppError("Resposta do Rasa não contém texto válido.", 500);
  }

  // parse JSON ou texto livre
  let jsonData: { questions: any[] };
  try {
    jsonData = JSON.parse(rawText);
  } catch {
    jsonData = parseQuestionsFromTextService(rawText);
  }

  // valida formato
  if (!Array.isArray(jsonData.questions) || jsonData.questions.length !== 5) {
    throw new AppError("Formato inesperado de perguntas na resposta.", 500);
  }

  const perguntas = jsonData.questions;
  const gabarito  = response.data.responses[0]?.custom?.answer_keys || [];
  const nivel     = session.nivelAtual!;
  const assunto   = session.lastSubject!;

  // atualiza sessão Rasa
  session.lastQuestions  = perguntas.map((q) => q.question);
  session.lastAnswerKeys = gabarito;

  // persiste no FaqStore de forma aninhada
  (async () => {
    try {
      // busca ou cria o documento de 'assunto'
      let doc = await FaqStore.findOne({ assunto });
      if (!doc) {
        doc = await FaqStore.create({ assunto, subassuntos: [] });
      }

      // busca ou adiciona o bloco de subassunto
      let sub = doc.subassuntos.find((s) => s.name === pergunta);
      if (!sub) {
        sub = { name: pergunta, levels: new Map() } as any;
        doc.subassuntos.push(sub);
      }

      // atribui/atualiza o bloco do nível dentro do subassunto
      sub.levels.set(nivel, {
        questions: perguntas,
        answer_keys: gabarito,
      });

      // salva sem bloquear a resposta ao usuário
      await doc.save();
    } catch (err) {
      console.error("faqstore: erro ao salvar perguntas aninhadas:", err);
    }
  })();

  // retorna as perguntas ao controller
  return {
    perguntas,
    gabarito,
    nivel,
    assunto,
  };
}
