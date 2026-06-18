jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { assertDashboardScopeAccess } from "../services/dashboard/dashboardPermissionService";

describe("assertDashboardScopeAccess", () => {
  it("permite ao administrador consultar qualquer escopo", async () => {
    await expect(
      assertDashboardScopeAccess(
        {
          id: "admin",
          name: "Admin",
          email: "admin@logibot.com",
          role: ["admin"],
          school: null,
        },
        { universityId: "outra-universidade" },
      ),
    ).resolves.toBeUndefined();
  });

  it("nega universidade fora do escopo da equipe acadêmica", async () => {
    await expect(
      assertDashboardScopeAccess(
        {
          id: "professor",
          name: "Professor",
          email: "professor@logibot.com",
          role: ["professor"],
          school: "universidade-permitida",
          courses: ["curso-permitido"],
        },
        { universityId: "outra-universidade" },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("não permite visão da universidade inteira para professor", async () => {
    await expect(
      assertDashboardScopeAccess(
        {
          id: "professor",
          name: "Professor",
          email: "professor@logibot.com",
          role: ["professor"],
          school: "universidade-permitida",
          courses: ["curso-permitido"],
        },
        { universityId: "universidade-permitida" },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
