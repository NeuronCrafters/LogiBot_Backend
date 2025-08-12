import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Professor } from '../models/Professor';

dotenv.config();

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

    const filter = { status: { $exists: false } };

    const update = { $set: { status: 'active' } };

    const result = await Professor.updateMany(filter, update);

    console.log('✨ Migração concluída!');
    console.log(`🔍 Documentos encontrados pelo filtro: ${result.matchedCount}`);
    console.log(`🔄 Documentos efetivamente atualizados: ${result.modifiedCount}`);

  } catch (error) {
    console.error('🔥 Ocorreu um erro durante a migração:', error);
  } finally {
    console.log('🔌 Desconectando do MongoDB...');
    await mongoose.disconnect();
  }
}

runMigration();