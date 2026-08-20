jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";
import {
  canManageQuiz,
  listManageableDisciplines,
} from "../services/quiz/quizPermissionService";

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

// Mock chainable pro query builder do drizzle: todo metodo devolve o proprio
// objeto (permite encadear .select().from().where()...), e cada `await` na
// cadeia consome o proximo resultado da fila, na ordem das chamadas reais.
function makeDb(results: unknown[]) {
  let call = 0;
  const methods = [
    "select",
    "from",
    "where",
    "limit",
    "orderBy",
    "groupBy",
    "innerJoin",
    "leftJoin",
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

const quiz = { id: "quiz-1", professorId: "owner-1", disciplineId: "d1" };

describe("canManageQuiz", () => {
  it("permite admin sem consultar o banco", async () => {
    (getDb as jest.Mock).mockReturnValue(makeDb([]));
    await expect(
      canManageQuiz(quiz, user({ id: "admin-1", role: ["admin"] })),
    ).resolves.toBe(true);
  });

  it("permite o dono do quiz sem consultar o banco", async () => {
    (getDb as jest.Mock).mockReturnValue(makeDb([]));
    await expect(
      canManageQuiz(quiz, user({ id: "owner-1", role: ["professor"] })),
    ).resolves.toBe(true);
  });

  it("permite coordenador quando alguma disciplina vinculada ao quiz esta no claim do JWT", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([[{ disciplineId: "d1" }, { disciplineId: "d2" }]]),
    );
    await expect(
      canManageQuiz(
        quiz,
        user({
          id: "coord-1",
          role: ["course-coordinator"],
          disciplines: ["d2"],
        }),
      ),
    ).resolves.toBe(true);
  });

  it("permite coordenador via vinculo em professor_disciplines quando o JWT nao tem a disciplina", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [{ disciplineId: "d1" }], // disciplinas vinculadas ao quiz
        [{ disciplineId: "d1" }], // vinculo do coordenador em professor_disciplines
      ]),
    );
    await expect(
      canManageQuiz(
        quiz,
        user({ id: "coord-1", role: ["course-coordinator"], disciplines: [] }),
      ),
    ).resolves.toBe(true);
  });

  it("nega coordenador sem nenhum vinculo com as disciplinas do quiz", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [{ disciplineId: "d1" }],
        [], // nenhum vinculo em professor_disciplines
      ]),
    );
    await expect(
      canManageQuiz(
        quiz,
        user({ id: "coord-1", role: ["course-coordinator"], disciplines: [] }),
      ),
    ).resolves.toBe(false);
  });

  it("nega professor comum que nao e dono, sem consultar o banco", async () => {
    (getDb as jest.Mock).mockReturnValue(makeDb([]));
    await expect(
      canManageQuiz(quiz, user({ id: "other-1", role: ["professor"] })),
    ).resolves.toBe(false);
  });
});

describe("listManageableDisciplines", () => {
  it("admin recebe todas as disciplinas sem filtro adicional", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [{ id: "d1", name: "Prog G1", courseId: "c1", courseName: "Curso A" }],
      ]),
    );
    const result = await listManageableDisciplines(
      user({ id: "admin-1", role: ["admin"] }),
    );
    expect(result).toEqual([
      { id: "d1", name: "Prog G1", courseId: "c1", courseName: "Curso A" },
    ]);
  });

  it("professor recebe so as disciplinas vinculadas a ele", async () => {
    (getDb as jest.Mock).mockReturnValue(
      makeDb([
        [{ disciplineId: "d1" }], // professor_disciplines do professor
        [{ id: "d1", name: "Prog G1", courseId: "c1", courseName: "Curso A" }], // select final
      ]),
    );
    const result = await listManageableDisciplines(
      user({ id: "prof-1", role: ["professor"] }),
    );
    expect(result).toEqual([
      { id: "d1", name: "Prog G1", courseId: "c1", courseName: "Curso A" },
    ]);
  });

  it("retorna lista vazia sem consultar disciplinas quando o professor nao tem nenhum vinculo", async () => {
    (getDb as jest.Mock).mockReturnValue(makeDb([[]]));
    const result = await listManageableDisciplines(
      user({ id: "prof-1", role: ["professor"] }),
    );
    expect(result).toEqual([]);
  });
});
