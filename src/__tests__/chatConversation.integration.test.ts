import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { editChatMessage, getRecentChatMessages, listChatSessionMessages } from "../services/chat/chatService";
import { getChatFollowUps, parseFollowUps } from "../services/chat/chatFollowUpService";
import { askOpenRouter } from "../services/ai/openRouterService";
import { withLanguage } from "../i18n";

jest.mock("../db/client", () => ({ getDb: () => mockDb }));
jest.mock("../services/ai/openRouterService", () => ({ askOpenRouter: jest.fn() }));
let mockDb: ReturnType<typeof drizzle<typeof schema>>;
const url = process.env.CHAT_CONVERSATION_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

describe("follow-up response parsing", () => {
  it("accepts JSON with code fences and rejects duplicates, non-strings and oversized prompts", () => {
    expect(parseFollowUps('```json\n{"suggestions":["  Como testar?  ","Como testar?",7,"Outro exemplo?",""]}\n```')).toEqual(["Como testar?", "Outro exemplo?"]);
    expect(parseFollowUps(JSON.stringify(["x".repeat(181)]))).toEqual([]);
    expect(parseFollowUps("invalid JSON")).toEqual([]);
  });
});

integration("chat editing and suggestions in an isolated database", () => {
  let pool: Pool;
  let session: string;
  let ids: string[];
  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith("_chat_conversation_check")) throw new Error("An isolated chat_conversation_check database is required");
    pool = new Pool({ connectionString: url });
    mockDb = drizzle(pool, { schema });
    await pool.query(`
      CREATE TABLE chat_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,session_id text NOT NULL,title text NOT NULL DEFAULT 'Nova Conversa',started_at timestamptz NOT NULL DEFAULT now(),last_activity_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,session_id));
      CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),chat_session_id uuid NOT NULL REFERENCES chat_sessions(id),role text NOT NULL,content text NOT NULL,detected_topic text,metadata jsonb NOT NULL DEFAULT '{}',timestamp timestamptz NOT NULL DEFAULT now());
      CREATE TABLE chat_generation_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),chat_session_id uuid NOT NULL,status text NOT NULL);
    `);
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    await pool.query("TRUNCATE chat_generation_jobs,chat_messages,chat_sessions CASCADE");
    session = (await pool.query("INSERT INTO chat_sessions(user_id,session_id,title) VALUES($1,'session','Original') RETURNING id", [owner])).rows[0].id;
    ids = [];
    for (const [index, content] of ["Pergunta original", "Resposta antiga", "Pergunta posterior", "Outra resposta"].entries()) {
      ids.push((await pool.query("INSERT INTO chat_messages(chat_session_id,role,content,detected_topic,timestamp) VALUES($1,$2,$3,'variaveis',now()+($4 * interval '1 second')) RETURNING id", [session, index % 2 ? "assistant" : "user", content, index - 10])).rows[0].id);
    }
  });
  afterAll(async () => { await pool?.end(); });
  const edit = (messageId = ids[0], userId = owner) => editChatMessage({ userId, sessionId: "session", messageId, message: "Pergunta corrigida", topic: "funcoes" });

  it("replaces the question and excludes later turns from history and model context while retaining their records", async () => {
    expect(await edit()).toMatchObject({ sessionId: "session", messageId: ids[0] });
    expect(await getRecentChatMessages(owner, "session")).toEqual([{ role: "user", content: "Pergunta corrigida" }]);
    expect((await listChatSessionMessages(owner, "session")).map(row => row.id)).toEqual([ids[0]]);
    const all = (await pool.query("SELECT * FROM chat_messages ORDER BY timestamp")).rows;
    expect(all).toHaveLength(4);
    expect(all[0].metadata.previousContent).toBe("Pergunta original");
    expect(all.slice(1).every(row => row.metadata.superseded === true)).toBe(true);
    expect((await pool.query("SELECT title FROM chat_sessions WHERE id=$1", [session])).rows[0].title).toBe("Pergunta corrigida");
  });
  it("preserves turns before an edited later question", async () => {
    await edit(ids[2]);
    expect((await getRecentChatMessages(owner, "session")).map(row => row.content)).toEqual(["Pergunta original", "Resposta antiga", "Pergunta corrigida"]);
  });
  it("rejects another user's message, assistant messages and archived questions without modifying history", async () => {
    await expect(edit(ids[0], other)).rejects.toMatchObject({ statusCode: 404 });
    await expect(edit(ids[1])).rejects.toMatchObject({ statusCode: 404 });
    expect(await listChatSessionMessages(owner, "session")).toHaveLength(4);
    await edit();
    await expect(edit(ids[2])).rejects.toMatchObject({ statusCode: 404 });
    expect(await listChatSessionMessages(owner, "session")).toHaveLength(1);
  });
  it("rejects editing while a queued or running job owns the conversation", async () => {
    await pool.query("INSERT INTO chat_generation_jobs(chat_session_id,status) VALUES($1,'running')", [session]);
    await expect(edit()).rejects.toMatchObject({ statusCode: 409 });
    expect(await listChatSessionMessages(owner, "session")).toHaveLength(4);
  });
  it("generates contextual suggestions once per answer and language, then uses persisted cache", async () => {
    (askOpenRouter as jest.Mock).mockResolvedValue({ text: '{"suggestions":["Como testar funções?","Como funcionam parâmetros?","Pode propor um exercício?"]}' });
    const input = { userId: owner, sessionId: "session", messageId: ids[3] };
    const first = await getChatFollowUps(input);
    expect(first.suggestions).toHaveLength(3);
    expect(await getChatFollowUps(input)).toEqual(first);
    expect(askOpenRouter).toHaveBeenCalledTimes(1);
    expect((askOpenRouter as jest.Mock).mock.calls[0][0][1].content).toContain("Outra resposta");
    await withLanguage("en-US", () => getChatFollowUps(input));
    expect(askOpenRouter).toHaveBeenCalledTimes(2);
  });
  it("never sends another user's history or a superseded answer to the suggestion model", async () => {
    const input = { userId: other, sessionId: "session", messageId: ids[3] };
    expect((await getChatFollowUps(input)).suggestions).toEqual([]);
    await edit();
    expect((await getChatFollowUps({ ...input, userId: owner })).suggestions).toEqual([]);
    expect(askOpenRouter).not.toHaveBeenCalled();
  });
  it("falls back to usable next steps when the suggestion provider is unavailable", async () => {
    (askOpenRouter as jest.Mock).mockRejectedValue(new Error("provider unavailable"));
    const result = await getChatFollowUps({ userId: owner, sessionId: "session", messageId: ids[3] });
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0]).toContain("exemplo");
  });
});
