jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";
import {
  linkQuizToDisciplines,
  listLinkedDisciplines,
  unlinkQuizFromDiscipline,
} from "../services/quiz/quizDisciplineService";

type AuthUser = NonNullable<import("express").Request["user"]>;

function user(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: "user-1",
    name: "User",
    email: "user@logibot.com",
    role: [],
    school: null,
    ...overrides,
  };
}

// Mesmo mock chainable de quizPermissionService.test.ts: cada `await` na
// cadeia consome o proximo resultado da fila, na ordem das chamadas reais.
function makeDb(results: unknown[]) {
  let call = 0;
  const methods = [
    "select",
    "from",
    "where",
    "limit",
    "orderBy",
    "insert",
    "values",
    "onConflictDoNothing",
    "returning",
    "update",
    "set",
    "delete",
  ];
  const chain: Record<string, unknown> = {};
  for (const method of methods) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => {
    const value = results[call++];
    return Promise.resolve(value).then(resolve);
  };
  return chain;
}

const admin = user({ id: "admin-1", role: ["admin"] });
const quizRow = { id: "quiz-1", professorId: "owner-1", disciplineId: "d1" };

describe("listLinkedDisciplines", () => {
  it("retorna as disciplinas vinculadas ao quiz", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([[quizRow], [{ disciplineId: "d1" }, { disciplineId: "d2" }]]),
    );
    await expect(listLinkedDisciplines(admin, "quiz-1")).resolves.toEqual([
      "d1",
      "d2",
    ]);
  });
});

describe("linkQuizToDisciplines", () => {
  it("vincula a varias disciplinas novas sem reprocessar nada", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [quizRow], // getQuizOrThrow
        [{ quizId: "quiz-1", disciplineId: "d2" }], // insert d2 (novo)
        [{ quizId: "quiz-1", disciplineId: "d3" }], // insert d3 (novo)
      ]),
    );
    const result = await linkQuizToDisciplines(admin, "quiz-1", ["d2", "d3"]);
    expect(result.linkedDisciplineIds).toEqual(["d2", "d3"]);
  });

  it("e idempotente — disciplina ja vinculada nao conta de novo (onConflictDoNothing)", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [quizRow], // getQuizOrThrow
        [], // insert d2 — ja existia, onConflictDoNothing nao retorna linha
        [{ quizId: "quiz-1", disciplineId: "d3" }], // insert d3 (novo)
      ]),
    );
    const result = await linkQuizToDisciplines(admin, "quiz-1", ["d2", "d3"]);
    expect(result.linkedDisciplineIds).toEqual(["d3"]);
  });

  it("rejeita quando nenhuma disciplina e informada", async () => {
    (getDb as jest.Mock).mockReturnValue(makeDb([[quizRow]]));
    await expect(
      linkQuizToDisciplines(admin, "quiz-1", []),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("unlinkQuizFromDiscipline", () => {
  it("bloqueia remover a ultima disciplina vinculada", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [quizRow], // getQuizOrThrow
        [{ disciplineId: "d1" }], // so 1 vinculo restante
      ]),
    );
    await expect(
      unlinkQuizFromDiscipline(admin, "quiz-1", "d1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("remove uma disciplina que nao e a dona, mantendo o quiz intacto", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [quizRow], // getQuizOrThrow (dona = d1)
        [{ disciplineId: "d1" }, { disciplineId: "d2" }], // 2 vinculos
        undefined, // delete
      ]),
    );
    await expect(
      unlinkQuizFromDiscipline(admin, "quiz-1", "d2"),
    ).resolves.toMatchObject({ quiz: quizRow });
  });

  it("reatribui a disciplina dona ao remover justamente a atual", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [quizRow], // getQuizOrThrow (dona = d1)
        [{ disciplineId: "d1" }, { disciplineId: "d2" }], // 2 vinculos
        undefined, // delete do vinculo com d1
        [{ ...quizRow, disciplineId: "d2" }], // update da nova dona
      ]),
    );
    await expect(
      unlinkQuizFromDiscipline(admin, "quiz-1", "d1"),
    ).resolves.toMatchObject({ quiz: quizRow });
  });
});
