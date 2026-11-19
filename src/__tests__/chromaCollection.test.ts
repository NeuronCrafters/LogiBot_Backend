import { runInEnvironment } from "../db/environment";
import { dropSandboxCollection, getChromaCollectionName } from "../services/rag/chromaService";

describe("Chroma collection per environment", () => {
  const saved = { collection: process.env.CHROMA_COLLECTION, url: process.env.CHROMA_URL };
  afterEach(() => {
    process.env.CHROMA_COLLECTION = saved.collection;
    process.env.CHROMA_URL = saved.url;
    if (saved.collection === undefined) delete process.env.CHROMA_COLLECTION;
    if (saved.url === undefined) delete process.env.CHROMA_URL;
  });

  it("keeps the real collection in production and a separate one in the test environment", () => {
    delete process.env.CHROMA_COLLECTION;
    expect(getChromaCollectionName()).toBe("logibots_rag_chunks");
    expect(runInEnvironment("sandbox", getChromaCollectionName)).toBe("logibots_rag_chunks_sandbox");
    process.env.CHROMA_COLLECTION = "custom";
    expect(runInEnvironment("production", getChromaCollectionName)).toBe("custom");
    expect(runInEnvironment("sandbox", getChromaCollectionName)).toBe("custom_sandbox");
  });

  it("never drops a collection outside the test environment", async () => {
    process.env.CHROMA_URL = "http://chroma.invalid:8000";
    await expect(runInEnvironment("production", dropSandboxCollection)).resolves.toBe(false);
    delete process.env.CHROMA_URL;
    await expect(runInEnvironment("sandbox", dropSandboxCollection)).resolves.toBe(false);
  });
});
