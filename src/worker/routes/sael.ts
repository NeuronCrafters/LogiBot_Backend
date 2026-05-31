import { Hono } from "hono";
import { HttpError } from "../errors";
import { requireAuth } from "../http/auth";
import { callRasaAction, generateRasaQuestions } from "../services/rasa";
import { getRuntimeSession } from "../services/sessionMemory";
import type { AppBindings } from "../types";

export const saelRoutes = new Hono<AppBindings>();

saelRoutes.use("/sael/*", requireAuth);

saelRoutes.get("/sael/action/inicio", async (c) => {
  const data = await callRasaAction(c.env, {
    next_action: "action_escolher_caminho",
    tracker: { sender_id: c.get("user")?.id || "user" },
  });
  return c.json(data);
});

saelRoutes.post("/sael/action/conversar", async (c) => {
  const data = await callRasaAction(c.env, {
    next_action: "action_escolher_caminho",
    tracker: {
      sender_id: c.get("user")?.id || "user",
      slots: { caminho_escolhido: "conversa" },
    },
  });

  const payload = data as { messages?: Array<{ text?: string }>; text?: string };
  const text = payload.messages?.[0]?.text || payload.text || "Desculpe, nao entendi.";
  return c.json({ responses: [{ text }] });
});

saelRoutes.get("/sael/action/listar_niveis", async (c) => {
  const data = await callRasaAction(c.env, {
    next_action: "action_listar_niveis",
    tracker: { sender_id: c.get("user")?.id || "user" },
  });
  return c.json(data);
});

saelRoutes.post("/sael/action/definir_nivel", async (c) => {
  const { nivel } = await c.req.json<{ nivel?: string }>();
  const user = c.get("user");
  if (!nivel || !user?.id) throw new HttpError("nivel e usuario sao obrigatorios", 400);

  const data = await callRasaAction(c.env, {
    next_action: "action_definir_nivel",
    tracker: {
      sender_id: user.id,
      slots: { nivel },
    },
  });

  getRuntimeSession(user.id).nivelAtual = nivel;
  return c.json(data);
});

saelRoutes.get("/sael/action/listar_opcoes", async (c) => {
  const data = await callRasaAction(c.env, {
    next_action: "action_listar_opcoes",
    tracker: { sender_id: c.get("user")?.id || "user" },
  });
  return c.json(data);
});

saelRoutes.post("/sael/action/listar_subopcoes", async (c) => {
  const { categoria } = await c.req.json<{ categoria?: string }>();
  const user = c.get("user");
  if (!categoria || !user?.id) throw new HttpError("categoria e usuario sao obrigatorios", 400);

  getRuntimeSession(user.id).lastSubject = categoria;
  const data = await callRasaAction(c.env, {
    next_action: "action_listar_subopcoes",
    tracker: {
      sender_id: user.id,
      slots: { categoria },
    },
  });

  return c.json(data);
});

saelRoutes.post("/sael/action/gerar_perguntas", async (c) => {
  const { pergunta } = await c.req.json<{ pergunta?: string }>();
  const user = c.get("user");
  if (!pergunta || !user?.id) throw new HttpError("pergunta e usuario sao obrigatorios", 400);

  const session = getRuntimeSession(user.id);
  if (!session.nivelAtual) {
    throw new HttpError("o nivel do usuario precisa ser definido antes de gerar perguntas.", 400);
  }

  const result = await generateRasaQuestions(c.env, pergunta, session.nivelAtual);
  session.lastSubject = pergunta;
  session.lastQuestions = result.perguntas.map((question) => question.question);
  session.lastFullQuestions = result.perguntas.map((question) => ({ ...question, explanation: {} }));
  session.lastAnswerKeys = result.gabarito;

  return c.json(result);
});

saelRoutes.get("/sael/action/get_gabarito", (c) => {
  const user = c.get("user");
  if (!user?.id) throw new HttpError("usuario obrigatorio", 400);

  const session = getRuntimeSession(user.id);
  return c.json({
    answer_keys: session.lastAnswerKeys,
    assunto: session.lastSubject,
  });
});
