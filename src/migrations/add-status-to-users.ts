import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User'

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runMigration() {
  const MONGO_URI = process.env.MONGO_URI as string;

  if (!MONGO_URI) {
    console.error('❌ ERRO: A variável de ambiente MONGO_URI não está definida.');
    process.exit(1);
  }

  try {
    console.log('⏳ Conectando ao MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conexão bem-sucedida!');

    console.log('🚀 Iniciando a migração para adicionar o campo "status"...');

    // 1. O Filtro: Encontrar todos os usuários que NÃO possuem o campo 'status'.
    // Isso torna o script seguro para ser executado múltiplas vezes (idempotente).
    const filter = { status: { $exists: false } };

    // 2. A Atualização: Definir o campo 'status' como 'active'.
    // Usamos o operador $set para adicionar/modificar o campo.
    const update = { $set: { status: 'active' } };

    // 3. A Execução: Usar updateMany para aplicar a atualização em todos os documentos encontrados.
    const result = await User.updateMany(filter, update);

    console.log('✨ Migração concluída!');
    console.log(`🔍 Documentos encontrados pelo filtro: ${result.matchedCount}`);
    console.log(`🔄 Documentos efetivamente atualizados: ${result.modifiedCount}`);

  } catch (error) {
    console.error('🔥 Ocorreu um erro durante a migração:', error);
  } finally {
    // Garante que a conexão com o banco de dados será sempre fechada
    console.log('🔌 Desconectando do MongoDB...');
    await mongoose.disconnect();
  }
}

// Executa a função principal da migração
runMigration();