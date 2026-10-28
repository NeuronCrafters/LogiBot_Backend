import axios from "axios";
import { getLanguage, withLanguage, type Language } from "../i18n";
import { processNextChatGenerationJob } from "../services/chat/chatService";
import { generateNoRagResponse } from "../services/generation/noRagStrategy";
import { chatMessages } from "../db/schema";

jest.mock("axios");
jest.mock("../db/client", () => ({getDb: () => mockDb}));
jest.mock("../services/generation/generationService", () => ({
  generateChatResponse: (...args: unknown[]) => mockGenerate(...args),
}));
jest.mock("../logger", () => ({logger: {info: jest.fn(),warn: jest.fn(),error: jest.fn()}}));

const mockGenerate = jest.fn();
const mockPost = axios.post as jest.Mock;
const persisted: any[] = [];
let queued: Language[] = [];
const mockDb = {
  transaction: async (callback: (tx: unknown) => unknown) => {
    const language = queued.shift();
    return callback({
      execute: async () => ({rows: language ? [{jobId:language,userId:language,chatSessionId:language,sessionId:language,userMessageId:language,message:'O que é uma variável?',attempts:0,outputLanguage:language}] : []}),
      update: () => ({set: () => ({where: async () => {}})}),
    });
  },
  select: () => ({from: () => ({where: () => {
    const language = getLanguage();
    const rows = [{id:language,title:'Existing title'}];
    return Object.assign(Promise.resolve(rows), {
      orderBy: () => ({limit: async () => [{role:'user',content:'O que é uma variável?'}]}),
    });
  }})}),
  insert: (table: unknown) => ({values: (value: unknown) => {
    if (table === chatMessages) persisted.push(value);
    return {onConflictDoUpdate: async () => {}, returning: async () => [{id:getLanguage()}]};
  }}),
  update: () => ({set: () => ({where: async () => {}})}),
};

describe('idioma dos jobs no worker', () => {
  const originalEnv = {...process.env};
  afterEach(() => {process.env = {...originalEnv};});

  it('usa idioma salvo no job até o payload do provedor e a mensagem persistida, isolando concorrência', async () => {
    process.env.OPENROUTER_API_KEY='test';
    process.env.OPENROUTER_MODEL='test/model';
    process.env.OPENROUTER_MAX_CONCURRENCY='1';
    queued=['en-US','es-ES','pt-BR'];
    persisted.length=0;
    mockGenerate.mockImplementation(async (input) => {
      await new Promise(resolve=>setTimeout(resolve,1));
      return generateNoRagResponse(input);
    });
    mockPost.mockImplementation(async (_url, body) => {
      const language=getLanguage();
      const prompt=body.messages[0].content;
      expect(prompt).toContain(language==='en-US'?'Always respond in American English':language==='es-ES'?'Responde siempre en español':'Responda sempre em português do Brasil');
      expect(body.messages.find((message:any)=>message.role==='user').content).toBe('O que é uma variável?');
      await new Promise(resolve=>setTimeout(resolve,2));
      expect(getLanguage()).toBe(language);
      return {data:{choices:[{message:{content:language}}]}};
    });
    expect(await withLanguage('pt-BR',()=>Promise.all(Array.from({length:3},()=>processNextChatGenerationJob())))).toEqual([true,true,true]);
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect(persisted.map(value=>[value.content,value.metadata.outputLanguage]).sort()).toEqual([['en-US','en-US'],['es-ES','es-ES'],['pt-BR','pt-BR']]);
    expect(getLanguage()).toBe('pt-BR');
  });
});
