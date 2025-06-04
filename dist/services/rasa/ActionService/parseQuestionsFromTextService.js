"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseQuestionsFromTextService = parseQuestionsFromTextService;
function parseQuestionsFromTextService(text) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const questions = [];
    let currentQuestion = null;
    for (const line of lines) {
        // Exemplo: "1) O que é uma variável?"
        const questionMatch = line.match(/^\d+\)\s*(.+)/);
        if (questionMatch) {
            // Salva a pergunta anterior
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question: questionMatch[1].trim(),
                options: [],
            };
            continue;
        }
        // Exemplo de alternativa: "- (a) É um espaço na memória"
        const optionMatch = line.match(/^[-*]\s*\(?[a-eA-E]\)?\s*(.+)/);
        if (optionMatch && currentQuestion) {
            currentQuestion.options.push(optionMatch[1].trim());
            continue;
        }
        // Fallback: aceita também formatos como "a) texto", "b) texto"
        const fallbackOptionMatch = line.match(/^[a-eA-E]\)\s*(.+)/);
        if (fallbackOptionMatch && currentQuestion) {
            currentQuestion.options.push(fallbackOptionMatch[1].trim());
        }
    }
    // Adiciona última pergunta
    if (currentQuestion) {
        questions.push(currentQuestion);
    }
    // Validação: cada pergunta deve ter no mínimo 2 alternativas
    for (const q of questions) {
        if (q.options.length < 2) {
            throw new Error(`Pergunta incompleta: "${q.question}"`);
        }
    }
    return { questions };
}
