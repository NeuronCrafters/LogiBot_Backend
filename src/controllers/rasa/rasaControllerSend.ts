import { Request, Response } from "express";
import { rasaServiceSend } from "../../services/rasa/rasaServiceSend";
import { UserAnalysis } from "../../models/UserAnalysis";
import jwt from "jsonwebtoken";

class RasaControllerSend {
  async handle(req: Request, res: Response) {
    try {
      // 🔹 Verifica o token do usuário
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.error("[Erro] Token JWT não fornecido no cabeçalho Authorization.");
        return res.status(401).json({ error: "Token não fornecido." });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        console.error("[Erro] Token JWT inválido.");
        return res.status(401).json({ error: "Token inválido." });
      }

      let userId: string | undefined;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string };
        if (!decoded.id) {
          console.error("[Erro] Token JWT não contém ID do usuário.");
          return res.status(401).json({ error: "Token inválido ou expirado." });
        }
        userId = decoded.id;
      } catch (error) {
        console.error("[Erro] Falha ao verificar token JWT:", error);
        return res.status(401).json({ error: "Token inválido ou expirado." });
      }

      if (!userId) {
        console.error("[Erro] userId não extraído do token.");
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      console.log(`[DEBUG] Usuário autenticado: ${userId}`);

      // 🔹 Obtém a mensagem do usuário
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "O campo 'message' é obrigatório." });
      }

      console.log(`[DEBUG] Enviando mensagem para Rasa: ${message}`);

      // 🔹 Envia a mensagem para o Rasa e obtém a resposta
      const response = await rasaServiceSend(message, userId);
      console.log(`[DEBUG] Resposta do Rasa recebida: ${JSON.stringify(response)}`);

      const botResponse = response.length ? response[0].text : "";

      // 🔹 Busca a análise do usuário no banco
      const userAnalysis = await UserAnalysis.findOne({ userId });

      if (!userAnalysis || userAnalysis.sessions.length === 0) {
        return res.status(404).json({ error: "Nenhuma sessão ativa encontrada para este usuário." });
      }

      // 🔹 Obtém a última sessão ativa
      const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];

      if (lastSession.sessionEnd) {
        return res.status(400).json({ error: "A sessão do usuário já foi encerrada." });
      }

      // 🔹 Adiciona a interação dentro da sessão ativa
      lastSession.interactions.push({
        timestamp: new Date(),
        message,
        botResponse,
      });

      // 🔹 Salva a atualização no banco de dados
      await userAnalysis.save();

      console.log(`[UserAnalysis] Interação registrada para usuário: ${userId}`);

      return res.json(response);
    } catch (error) {
      console.error("[RasaControllerSend] Erro ao processar interação:", error);
      return res.status(500).json({ error: "Erro interno no servidor." });
    }
  }
}

export { RasaControllerSend };
