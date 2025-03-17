import { Request, Response } from "express";
import { RasaActionService } from "../../services/rasa/rasaActionService";
import jwt from "jsonwebtoken";

class RasaActionController {
  private rasaActionService: RasaActionService;

  constructor() {
    this.rasaActionService = new RasaActionService();
  }

  async listarNiveis(req: Request, res: Response) {
    try {
      const niveis = await this.rasaActionService.listarNiveis();
      return res.status(200).json(niveis);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter os níveis", error: error.message });
    }
  }

  async definirNivel(req: Request, res: Response) {
    try {
      const { nivel } = req.body;
      const result = await this.rasaActionService.definirNivel(nivel);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao definir o nível", error: error.message });
    }
  }

  async listarOpcoes(req: Request, res: Response) {
    try {
      const opcoes = await this.rasaActionService.listarOpcoes();
      return res.status(200).json(opcoes);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter as opções", error: error.message });
    }
  }

  async sendOpcaoEListarSubopcoes(req: Request, res: Response) {
    try {
      const { categoria } = req.body;
      const subopcoes = await this.rasaActionService.sendOpcaoEListarSubopcoes(categoria);
      return res.status(200).json(subopcoes);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter as subopções", error: error.message });
    }
  }

  async gerarPerguntas(req: Request, res: Response) {
    try {
      const { pergunta } = req.body;
      const perguntas = await this.rasaActionService.gerarPerguntas(pergunta);
      return res.status(200).json(perguntas);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao gerar perguntas", error: error.message });
    }
  }

  async getGabarito(req: Request, res: Response) {
    try {
      const gabarito = await this.rasaActionService.getGabarito();
      return res.status(200).json(gabarito);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao obter o gabarito", error: error.message });
    }
  }

  async verificarRespostas(req: Request, res: Response) {
    try {
      console.log("Recebendo requisição para verificar respostas...");
      const { respostas } = req.body;

      if (!respostas) {
        console.log("Erro: As respostas não foram fornecidas.");
        return res.status(400).json({ message: "As respostas são obrigatórias." });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.log("Erro: Token não fornecido no cabeçalho da requisição.");
        return res.status(401).json({ message: "Token não fornecido." });
      }

      const token = authHeader.split(" ")[1];
      console.log("Token recebido:", token);

      let userData;
      try {
        userData = jwt.verify(token, process.env.JWT_SECRET as string);
        console.log("Token decodificado com sucesso:", userData);
      } catch (error) {
        console.log("Erro ao verificar token:", error);
        return res.status(401).json({ message: "Token inválido." });
      }

      if (!userData || typeof userData !== "object" || !userData.id || !userData.email) {
        console.log("Erro: Estrutura inválida do token decodificado.", userData);
        return res.status(401).json({ message: "Token inválido." });
      }

      const userId = userData.id;
      const email = userData.email;
      console.log("Usuário autenticado:", { userId, email });

      const resultado = await this.rasaActionService.verificarRespostas(respostas, userId, email);

      console.log("Resultado da verificação de respostas:", resultado);

      return res.status(200).json(resultado);
    } catch (error) {
      console.log("Erro inesperado ao verificar respostas:", error);
      return res.status(500).json({ message: "Erro ao verificar respostas", error: error.message });
    }
  }
}

export { RasaActionController };
