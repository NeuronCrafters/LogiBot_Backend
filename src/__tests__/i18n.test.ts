import { createHash } from "crypto";
import { readFileSync } from "fs";
import express from "express";
import request from "supertest";
import { AppError } from "../exceptions/AppError";
import { errorHandler } from "../http/errorHandler";
import { languageMiddleware, accountLanguage } from "../i18n/middleware";
import { catalogs, t, withLanguage, getLanguage, negotiateLanguage, normalizeLanguage, type Language, type MessageKey } from "../i18n";
import baseline from "./fixtures/portuguese-messages.json";
import hashes from "./fixtures/portuguese-prompt-hashes.json";
import { prepareOpenRouterMessages } from "../services/ai/openRouterConfig";

const app = express();
app.use(languageMiddleware);
app.get('/private', (req, res, next) => {
  accountLanguage(req, res, 'es-ES');
  next(new AppError('auth.accessDenied', 403));
});
app.get('/error', (_req, _res, next) => next(new AppError('auth.accessDenied', 403)));
app.get('/content-error', (_req, _res, next) => {
  withLanguage('en-US', () => next(new AppError('auth.accessDenied', 403)));
});
app.get('/async', (req, res) => {
  const before = getLanguage();
  setTimeout(() => res.json({ before, after: getLanguage(), message: t('auth.accessDenied') }), Number(req.query.delay || 1));
});
app.use(errorHandler);

describe('negociação de idiomas', () => {
  it.each([
    [undefined, 'pt-BR'], ['', 'pt-BR'], ['de-DE', 'pt-BR'], ['en-GB', 'en-US'], ['es-MX', 'es-ES'],
    ['pt-PT', 'pt-BR'], ['de;q=1,en;q=0.8,pt;q=0.5', 'en-US'], ['en;q=0,es;q=0.5', 'es-ES'],
    ['en;q=bad,es', 'es-ES'], ['en;q=1.2,pt;q=0.5', 'pt-BR'], ['en;q=0,*;q=0.5', 'pt-BR'],
    ['pt;q=0,*;q=0.5', 'en-US'], ['es;q=0.5,en;q=0.5', 'es-ES'],
  ])('resolve %s para %s', (header, expected) => expect(negotiateLanguage(header)).toBe(expected));

  it.each([['EN_us','en-US'], ['es-AR','es-ES'], ['pt','pt-BR'], ['javascript:en',undefined], ['en-US-invalid!',undefined]])('normaliza %s', (input, expected) => expect(normalizeLanguage(input)).toBe(expected));

  it('usa Accept-Language e mantém código/status estáveis', async () => {
    const pt = await request(app).get('/error').expect(403);
    const en = await request(app).get('/error').set('Accept-Language','en-US').expect(403);
    const es = await request(app).get('/error').set('Accept-Language','es').expect(403);
    expect(pt.body).toEqual({message:'acesso negado',code:'auth.accessDenied'});
    expect(en.body).toEqual({message:'access denied',code:'auth.accessDenied'});
    expect(es.body).toEqual({message:'acceso denegado',code:'auth.accessDenied'});
    expect(en.headers['content-language']).toBe('en-US');
    expect(en.headers.vary).toContain('Accept-Language');
  });

  it('prioriza escolha explícita, depois conta, depois navegador', async () => {
    const saved = await request(app).get('/private').set('Accept-Language','en').expect(403);
    expect(saved.headers['content-language']).toBe('es-ES');
    const explicit = await request(app).get('/private').set('Accept-Language','en').set('X-Language','pt-BR').expect(403);
    expect(explicit.headers['content-language']).toBe('pt-BR');
    expect(explicit.body.message).toBe('acesso negado');
  });

  it('responde erros no idioma da interface mesmo com conteúdo em outro idioma', async () => {
    const response = await request(app).get('/content-error').set('X-Language', 'pt-BR').expect(403);
    expect(response.headers['content-language']).toBe('pt-BR');
    expect(response.body).toEqual({message:'acesso negado',code:'auth.accessDenied'});
  });

  it('isola requisições concorrentes entre idiomas após await e timers', async () => {
    const languages: Language[] = ['pt-BR','en-US','es-ES'];
    const responses = await Promise.all(Array.from({length:30},(_,index) => {
      const language = languages[index % 3];
      return request(app).get('/async?delay='+String(index%7)).set('Accept-Language',language).then(response => ({response,language}));
    }));
    for (const {response,language} of responses) {
      expect(response.body.before).toBe(language);
      expect(response.body.after).toBe(language);
      expect(response.body.message).toBe(t('auth.accessDenied',{},language));
    }
    expect(getLanguage()).toBe('pt-BR');
  });
});

describe('preservação e catálogos', () => {
  it('preserva literalmente as 165 mensagens originais em português e seus parâmetros', () => {
    for (const [key, value] of Object.entries(baseline)) {
      let original = value.original;
      const params: Record<string,string> = {};
      value.expressions.forEach((expression,index) => {
        params['value'+index] = `param-${index}`;
        original = original.replace('${'+expression+'}',`param-${index}`);
      });
      expect(t(key as MessageKey,params,'pt-BR')).toBe(original);
    }
  });

  it('mantém paridade de chaves e parâmetros em inglês e espanhol', () => {
    const keys = Object.keys(catalogs['pt-BR']).sort();
    for (const language of ['en-US','es-ES'] as const) {
      expect(Object.keys(catalogs[language]).sort()).toEqual(keys);
      for (const key of keys as MessageKey[]) {
        const params = (text:string) => (text.match(/\{\{\w+\}\}/g)||[]).sort();
        expect(params(catalogs[language][key])).toEqual(params(catalogs['pt-BR'][key]));
        expect(catalogs[language][key].trim()).not.toBe('');
      }
    }
  });

  it('mantém os três arquivos de prompt originais em português sem alteração', () => {
    for (const [file,hash] of Object.entries(hashes)) expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(hash);
  });

  it.each(['en-US','es-ES'] as const)('explicita o idioma %s junto à pergunta sem reescrever o histórico', language => {
    const messages = [{role: 'user' as const, content: 'Explique o que é uma variável.'}];
    const prepared = withLanguage(language, () => prepareOpenRouterMessages('chat', messages));
    expect(prepared.slice(1,-1)).toEqual(messages);
    expect(prepared.at(-1)).toEqual({role:'system',content:t('chat.responseLanguage',{},language)});
    expect(messages).toEqual([{role:'user',content:'Explique o que é uma variável.'}]);
    expect(withLanguage('pt-BR',()=>prepareOpenRouterMessages('chat',messages)).slice(1)).toEqual(messages);
  });

  it('seleciona o prompt de cada finalidade sem misturar idiomas no cache', async () => {
    const results = await Promise.all((['pt-BR','en-US','es-ES'] as const).map(language => withLanguage(language, async () => {
      await Promise.resolve();
      return {language, prompts: ['chat','quiz','insights'].map(purpose => prepareOpenRouterMessages(purpose as 'chat'|'quiz'|'insights',[])[0].content)};
    })));
    for (const {language,prompts} of results) {
      for (const prompt of prompts) {
        expect(prompt).toContain(language==='pt-BR'?'português do Brasil':language==='en-US'?'American English':'español');
        if(language!=='pt-BR') expect(prompt).not.toContain('Responda sempre em português');
      }
    }
  });
});
