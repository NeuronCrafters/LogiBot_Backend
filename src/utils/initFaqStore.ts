import mongoose from "mongoose";
import { FaqStore } from "../models/FAQStore";

const CONFIG: Record<string, string[]> = {
    variaveis: ["variaveis_o_que_e", "variaveis_tipos_existentes", "variaveis_escopo_o_que_e"],
    listas: ["listas_o_que_e", "listas_como_adicionar_elemento", "listas_como_verificar_existencia"],
    condicionais: ["condicionais_o_que_e", "condicionais_tipo_composto", "condicionais_tipo_aninhado"],
    verificacoes: ["verificacao_o_que_e", "verificacao_maior_menor", "verificacao_impacto"],
    textos: ["textos_o_que_sao", "textos_como_criar", "textos_operacoes_concatenacao"],
    caracteres: ["caracteres_o_que_sao", "caracteres_como_converter", "caracteres_exemplo_codigo"],
    numeros: ["numeros_inteiros_o_que_sao", "numeros_decimais_o_que_sao", "numeros_decimais_exemplo_codigo"],
    operadores_matematicos: ["operadores_matematicos_basicos", "operadores_matematicos_exemplo_codigo"],
    operadores_logicos: ["operadores_logicos_o_que_sao", "operadores_logicos_exemplo_codigo"],
    operadores_ternarios: ["operadores_ternarios_o_que_sao", "operadores_ternarios_exemplo_codigo"],
    soma: ["soma_o_que_e", "soma_exemplo_codigo"],
    subtracao: ["subtracao_o_que_e", "subtracao_exemplo_codigo"],
    multiplicacao: ["multiplicacao_o_que_e", "multiplicacao_exemplo_codigo"],
    divisao_inteira: ["divisao_inteira_o_que_e", "divisao_inteira_exemplo_codigo"],
    divisao_resto: ["divisao_resto_o_que_e", "divisao_resto_exemplo_codigo"],
    divisao_normal: ["divisao_normal_o_que_e", "divisao_normal_exemplo_codigo"],
};

async function initFaqStore() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/seu_banco");

        console.log("🔗 Conectado ao MongoDB");

        for (const assunto of Object.keys(CONFIG)) {
            const existingDoc = await FaqStore.findOne({ assunto });

            if (!existingDoc) {
                const subassuntos = CONFIG[assunto].map(name => ({
                    name,
                    levels: { basico: [], intermediario: [], avancado: [] }
                }));

                await FaqStore.create({ assunto, subassuntos });

                console.log(`✅ Documento criado para o assunto: ${assunto}`);
            } else {
                console.log(`⚠️ Documento já existe para o assunto: ${assunto}`);
            }
        }

        console.log("🎉 Inicialização concluída com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao inicializar FaqStore:", error);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Desconectado do MongoDB");
    }
}

initFaqStore();
