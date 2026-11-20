import { randomUUID } from "crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import request from "supertest";

const url = process.env.INSTITUTIONS_TEST_DATABASE_URL;
const imageRoot = require("fs").mkdtempSync(require("path").join(require("os").tmpdir(), "institution-images-"));
const integration = url ? describe : describe.skip;

integration("institution page on PostgreSQL", () => {
  let pool: Pool;
  let app: import("express").Express;
  let client: typeof import("../db/client");
  const ids = { school: randomUUID(), other: randomUUID(), course: randomUUID(), classA: randomUUID(), classB: randomUUID(), discipline: randomUUID(), sibling: randomUUID(), siblingClass: randomUUID() };
  const people = { student: randomUUID(), professor: randomUUID(), coordinator: randomUUID(), admin: randomUUID(), owner: randomUUID() };
  const classmates = Array.from({ length: 5 }, () => randomUUID());
  const smallClass = Array.from({ length: 2 }, () => randomUUID());
  const password = "senha-de-teste-123";
  const email = (id: string) => (id === people.owner ? "owner-test@example.invalid" : `${id}@example.invalid`);

  beforeAll(async () => {
    if (!url!.includes("_institutions_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated institutions test database");
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-secret";
    process.env.OWNER_EMAILS = "owner-test@example.invalid";
    process.env.INSTITUTION_IMAGE_DIR = imageRoot;
    delete process.env.API_KEY;
    client = await import("../db/client");
    app = (await import("../server")).app;
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[] = []) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'Faculdade Teste'),($2,'Outra')", [ids.school, ids.other]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Computação',$2)", [ids.course, ids.school]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$2)", [ids.discipline, ids.course]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2)", [ids.classA, ids.discipline]);
    // A second course of the same institution that the coordinator does not coordinate.
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Matemática',$2)", [ids.sibling, ids.school]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'M',$2,$3)", [ids.siblingClass, ids.sibling, `M-${ids.siblingClass}`]);
    const hash = await bcrypt.hash(password, 4);
    for (const id of [...Object.values(people), ...classmates, ...smallClass])
      await q("INSERT INTO accounts(id,name,email,password_hash,status) VALUES($1,'Pessoa',$2,$3,'active')", [id, email(id), hash]);
    for (const id of [people.student, ...classmates, ...smallClass]) await q("INSERT INTO account_roles(account_id,role) VALUES($1,'student')", [id]);
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'professor'),($2,'professor'),($2,'course-coordinator'),($3,'admin'),($4,'admin')", [people.professor, people.coordinator, people.admin, people.owner]);
    await q("INSERT INTO professor_profiles(account_id,school_id) VALUES($1,$3),($2,$3)", [people.professor, people.coordinator, ids.school]);
    await q("INSERT INTO professor_courses(professor_id,course_id) VALUES($1,$2),($3,$2)", [people.professor, ids.course, people.coordinator]);
    for (const id of [people.student, ...classmates]) await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [id, ids.school, ids.course, ids.classA]);
    for (const id of smallClass) await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [id, ids.school, ids.course, ids.classB]);
    await q("UPDATE accounts SET name = 'Prof Regente' WHERE id = $1", [people.professor]);
    for (const [index, id] of classmates.entries()) await q("UPDATE accounts SET name = $2 WHERE id = $1", [id, `Colega ${index + 1}`]);
    for (const id of smallClass) await q("UPDATE accounts SET name = 'Outra turma' WHERE id = $1", [id]);
    await q("INSERT INTO professor_classes(professor_id,class_id) VALUES($1,$2)", [people.professor, ids.classA]);
    await q("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$2),($3,$2)", [people.professor, ids.discipline, people.coordinator]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[...Object.values(people), ...classmates, ...smallClass]]);
    await pool.query("DELETE FROM universities WHERE id = ANY($1)", [[ids.school, ids.other]]);
    await pool.end();
    await client.closeDatabasePool();
  });

  const signIn = async (id: string) => {
    const agent = request.agent(app);
    await agent.post("/auth/session").send({ email: email(id), password }).expect(200);
    return agent;
  };

  it("shows each profile only its own part of the institution", async () => {
    // Student: their class, its subject with the professor in charge, and the classmates' names.
    const student = (await (await signIn(people.student)).get(`/institutions/${ids.school}`).expect(200)).body;
    expect(student.viewer).toEqual({ level: "student", canEdit: false, canChangeStatus: false, canChangeComponents: false });
    expect(student).not.toHaveProperty("overview");
    expect(student).not.toHaveProperty("courses");
    expect(student).not.toHaveProperty("team");
    expect(student.myClass).toMatchObject({ name: "A", course: "Computação", disciplines: [{ name: "Lógica", professors: ["Prof Regente"] }] });
    expect(student.myClass.classmates).toEqual(["Colega 1", "Colega 2", "Colega 3", "Colega 4", "Colega 5"]);
    expect(JSON.stringify(student)).not.toContain("example.invalid");
    expect(JSON.stringify(student)).not.toContain("Outra turma");

    // Professor: only the classes taught, students per subject and weekly activity per subject.
    const professor = (await (await signIn(people.professor)).get(`/institutions/${ids.school}`).expect(200)).body;
    expect(professor.viewer.canEdit).toBe(false);
    expect(professor).not.toHaveProperty("overview");
    expect(professor.teaching.classes).toEqual([{ id: ids.classA, name: "A", course: "Computação", students: 6 }]);
    const [subject] = professor.teaching.disciplines;
    expect(subject).toMatchObject({ name: "Lógica", classes: ["A"] });
    expect(subject.students).toHaveLength(6);
    expect(subject.weeks).toHaveLength(7);
    expect(JSON.stringify(professor)).not.toContain("Outra turma");

    // Coordination: aggregated numbers of its own course only; small groups never show their size.
    const coordinator = (await (await signIn(people.coordinator)).get(`/institutions/${ids.school}`).expect(200)).body;
    expect(coordinator.viewer).toEqual({ level: "coordinator", canEdit: false, canChangeStatus: false, canChangeComponents: false });
    expect(coordinator.counts).toEqual({ courses: 1, classes: 2, disciplines: 1 });
    expect(coordinator.courses.map((course: { name: string }) => course.name)).toEqual(["Computação"]);
    expect(coordinator.overview).toMatchObject({ students: 8, chatSatisfaction: null });
    const [classA, classB] = coordinator.classes;
    expect(classA).toMatchObject({ name: "A", students: 6 });
    expect(classA).toHaveProperty("quizAccuracy");
    expect(classB).toMatchObject({ name: "B", students: null, activeShare: null });
    expect(coordinator.disciplines[0]).toHaveProperty("releasedExams", 0);
    expect(coordinator.team).toEqual({ coordinators: 1, professors: 1, students: 8 });
    expect(JSON.stringify(coordinator)).not.toContain("Colega");

    // Admin: the whole institution.
    const admin = (await (await signIn(people.admin)).get(`/institutions/${ids.school}`).expect(200)).body;
    expect(admin.viewer.canEdit).toBe(true);
    expect(admin.counts).toEqual({ courses: 2, classes: 3, disciplines: 1 });
  });

  it("keeps each member inside their own institution and lets only admins edit", async () => {
    const coordinator = await signIn(people.coordinator);
    await coordinator.get(`/institutions/${ids.other}`).expect(404);
    expect((await coordinator.get("/institutions").expect(200)).body).toEqual([
      { id: ids.school, name: "Faculdade Teste", kind: null, city: null, state: null, logo: null, active: true, courses: 2, classes: 3 },
    ]);
    // Editing belongs to the admin (who hires the service): coordination and professors only read.
    await coordinator.put(`/institutions/${ids.school}`).send({ name: "X" }).expect(403);
    await coordinator.put(`/institutions/${ids.school}/logo`).send({ image: null }).expect(403);
    const editor = await signIn(people.admin);
    await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", kind: "faculdade", city: "Belém", website: "teste.edu.br", about: "Sobre." }).expect(200);
    const page = (await editor.get(`/institutions/${ids.school}`).expect(200)).body;
    expect(page.institution).toMatchObject({ kind: "faculdade", city: "Belém", website: "https://teste.edu.br", about: "Sobre." });
    const invalid = (await editor.put(`/institutions/${ids.school}`).send({ name: "", kind: "castelo", website: "não é site" }).expect(400)).body;
    expect(invalid.issues.map((issue: { field: string }) => issue.field).sort()).toEqual(["kind", "name", "website"]);
    // Social networks and other sites: optional; an Instagram "@name" becomes its address, empty rows are ignored.
    await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", links: [
      { kind: "instagram", url: "@faculdade.teste" }, { kind: "facebook", url: "facebook.com/faculdadeteste" }, { kind: "blog", url: "" },
    ] }).expect(200);
    expect((await editor.get(`/institutions/${ids.school}`)).body.institution.links).toEqual([
      { kind: "instagram", url: "https://instagram.com/faculdade.teste" }, { kind: "facebook", url: "https://facebook.com/faculdadeteste" },
    ]);
    const badLinks = (await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", links: [
      { kind: "site", url: "javascript:alert(1)" }, { kind: "tiktok", url: "tiktok.com/x" },
    ] }).expect(400)).body;
    expect(badLinks.issues).toEqual([{ field: "links.0", code: "INVALID" }, { field: "links.1", code: "INVALID" }]);
    const tooMany = (await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", links: Array.from({ length: 9 }, () => ({ kind: "site", url: "a.com" })) }).expect(400)).body;
    expect(tooMany.issues).toEqual([{ field: "links", code: "TOO_MANY", params: { max: 8 } }]);
    await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", kind: "faculdade", city: "Belém", website: "teste.edu.br", about: "Sobre.", links: [] }).expect(200);
    expect((await editor.get(`/institutions/${ids.school}`)).body.institution.links).toEqual([]);
    await (await signIn(people.professor)).put(`/institutions/${ids.school}`).send({ name: "X" }).expect(403);

    // Images: PNG, JPEG or WebP as data URL, within the size limit; null removes.
    const tiny = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString("base64");
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: tiny }).expect(200);
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: "data:text/html;base64,PGI+" }).expect(400);
    // Declared as PNG but not a PNG (e.g. HTML or a script renamed): refused by its content.
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64") }).expect(400);
    await editor.put(`/institutions/${ids.school}/cover`).send({ image: "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString("base64") }).expect(200);
    await editor.put(`/institutions/${ids.school}/cover`).send({ image: "data:image/webp;base64," + Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "latin1").toString("base64") }).expect(200);
    await editor.put(`/institutions/${ids.school}/cover`).send({ image: null }).expect(200);
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: "data:image/png;base64," + "A".repeat(500 * 1024) }).expect(413);
    // Stored in the image volume, not in the database; read back through the public read-only address.
    const logoPath = (await editor.get(`/institutions/${ids.school}`)).body.institution.logo as string;
    expect(logoPath).toMatch(/^\/institution-images\/production\/[a-f0-9]{64}\.png$/);
    expect((await pool.query("SELECT logo FROM institution_profiles WHERE university_id=$1", [ids.school])).rows[0].logo).toMatch(/^file:production\//);
    const served = await request(app).get(logoPath).expect(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(served.body).equals(Buffer.from(tiny.split(",")[1], "base64"))).toBe(true);
    await request(app).get("/institution-images/production/../../etc/passwd").expect(404);
    await request(app).get("/institution-images/production/not-a-hash.png").expect(404);
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: null }).expect(200);
    // Removed from the volume when no institution uses it any more.
    await request(app).get(logoPath).expect(404);

    // Older rows with the image inside the database move to the volume the first time they are read.
    await pool.query("UPDATE institution_profiles SET cover=$2 WHERE university_id=$1", [ids.school, tiny]);
    expect((await editor.get(`/institutions/${ids.school}`)).body.institution.cover).toMatch(/^\/institution-images\/production\//);
    expect((await pool.query("SELECT cover FROM institution_profiles WHERE university_id=$1", [ids.school])).rows[0].cover).toMatch(/^file:production\//);
    await editor.put(`/institutions/${ids.school}/cover`).send({ image: null }).expect(200);

    expect((await editor.get("/institutions").expect(200)).body.map((row: { id: string }) => row.id)).toEqual(expect.arrayContaining([ids.school, ids.other]));
    await editor.put(`/institutions/${ids.other}`).send({ name: "Outra" }).expect(200);
  });

  it("keeps the address and map point, and lets the owner turn the location and the photo off", async () => {
    const editor = await signIn(people.admin);
    const owner = await signIn(people.owner);
    const place = { name: "Faculdade Teste", city: "Belém", state: "PA", country: "Brasil", address: "Av. Exemplo", addressNumber: "100", district: "Guamá", postalCode: "66000-000", latitude: "-1.4558", longitude: -48.4902 };
    await editor.put(`/institutions/${ids.school}`).send(place).expect(200);
    let page = (await editor.get(`/institutions/${ids.school}`).expect(200)).body;
    expect(page.components).toEqual({ location: true, photo: true });
    expect(page.institution).toMatchObject({ address: "Av. Exemplo", addressNumber: "100", district: "Guamá", postalCode: "66000-000", latitude: -1.4558, longitude: -48.4902 });
    const half = (await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", latitude: 10 }).expect(400)).body;
    expect(half.issues).toEqual([{ field: "longitude", code: "PAIR" }]);
    const out = (await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", latitude: 95, longitude: 0 }).expect(400)).body;
    expect(out.issues).toEqual([{ field: "latitude", code: "INVALID" }]);

    // Map search goes through the server (the service is replaced here).
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ display_name: "Av. Exemplo, Belém", lat: "-1.45", lon: "-48.49" }]), { status: 200 }));
    expect((await editor.get(`/institutions/${ids.school}/geocode`).query({ q: "Av. Exemplo, Belém" }).expect(200)).body)
      .toEqual([{ label: "Av. Exemplo, Belém", latitude: -1.45, longitude: -48.49 }]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=Av.%20Exemplo%2C%20Bel%C3%A9m");
    await editor.get(`/institutions/${ids.school}/geocode`).query({ q: "a" }).expect(400);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await editor.get(`/institutions/${ids.school}/geocode`).query({ q: "Belém" }).expect(502);
    await (await signIn(people.professor)).get(`/institutions/${ids.school}/geocode`).query({ q: "Belém" }).expect(403);

    // CEP: street, city and state filled from ViaCEP (replaced here), also through the server.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ cep: "66075-110", logradouro: "Rua Augusto Corrêa", bairro: "Guamá", localidade: "Belém", uf: "PA" }), { status: 200 }));
    expect((await editor.get(`/institutions/${ids.school}/postal-code`).query({ cep: "66075-110" }).expect(200)).body)
      .toEqual({ postalCode: "66075-110", address: "Rua Augusto Corrêa", district: "Guamá", city: "Belém", state: "PA", country: "Brasil" });
    expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])).toContain("/66075110/json/");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ erro: "true" }), { status: 200 }));
    await editor.get(`/institutions/${ids.school}/postal-code`).query({ cep: "00000000" }).expect(404);
    await editor.get(`/institutions/${ids.school}/postal-code`).query({ cep: "123" }).expect(400);
    await (await signIn(people.coordinator)).get(`/institutions/${ids.school}/postal-code`).query({ cep: "66075110" }).expect(403);

    // A street address saved without a map point gets one from the search; if the search fails, it saves anyway.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ display_name: "Rua Augusto Corrêa, Belém", lat: "-1.47", lon: "-48.45" }]), { status: 200 }));
    await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", address: "Rua Augusto Corrêa", addressNumber: "1", city: "Belém", state: "PA", postalCode: "66075-110" }).expect(200);
    expect((await editor.get(`/institutions/${ids.school}`)).body.institution).toMatchObject({ latitude: -1.47, longitude: -48.45 });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", address: "Rua Sem Ponto", city: "Belém" }).expect(200);
    expect((await editor.get(`/institutions/${ids.school}`)).body.institution).toMatchObject({ address: "Rua Sem Ponto", latitude: null });
    await editor.put(`/institutions/${ids.school}`).send(place).expect(200);
    fetchMock.mockRestore();

    // Only the owner switches components, for this institution.
    const tiny = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString("base64");
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: tiny }).expect(200);
    await editor.put("/features/rules").send({ feature: "institution_location", scope: "institution", scopeId: ids.school, enabled: false }).expect(403);
    for (const feature of ["institution_location", "institution_photo"])
      await owner.put("/features/rules").send({ feature, scope: "institution", scopeId: ids.school, enabled: false }).expect(200);
    page = (await editor.get(`/institutions/${ids.school}`).expect(200)).body;
    expect(page.components).toEqual({ location: false, photo: false });
    expect(page.institution).toMatchObject({ city: null, state: null, address: null, addressNumber: null, district: null, latitude: null, longitude: null, logo: null });
    expect((await editor.get("/institutions").expect(200)).body[0]).toMatchObject({ city: null, logo: null });
    await editor.put(`/institutions/${ids.school}/logo`).send({ image: tiny }).expect(403);
    await editor.get(`/institutions/${ids.school}/geocode`).query({ q: "Belém" }).expect(403);
    // Editing other data keeps the saved location untouched.
    await editor.put(`/institutions/${ids.school}`).send({ name: "Faculdade Teste", city: "Outra" }).expect(200);
    // The other institution is not affected.
    expect((await owner.get(`/institutions/${ids.other}`).expect(200)).body.components).toEqual({ location: true, photo: true });

    for (const feature of ["institution_location", "institution_photo"])
      await owner.post("/features/rules/clear").send({ feature, scope: "institution", scopeId: ids.school }).expect(204);
    page = (await editor.get(`/institutions/${ids.school}`).expect(200)).body;
    expect(page.institution).toMatchObject({ city: "Belém", address: "Av. Exemplo", addressNumber: "100", latitude: -1.4558 });
    expect(page.institution.logo).toMatch(/^\/institution-images\/production\//);
    expect(page.viewer.canChangeComponents).toBe(false);
  });

  it("only the owner turns an institution off, which blocks its members until it is back on", async () => {
    const student = await signIn(people.student);
    await (await signIn(people.admin)).post(`/institutions/${ids.school}/status`).send({ active: false }).expect(403);
    const owner = await signIn(people.owner);
    expect((await owner.get(`/institutions/${ids.school}`).expect(200)).body.viewer.canChangeStatus).toBe(true);
    expect((await owner.post(`/institutions/${ids.school}/status`).send({ active: false }).expect(200)).body.active).toBe(false);

    // Open sessions stop working and new sign-ins are refused, with the explanation.
    expect((await student.get("/auth/me").expect(403)).body.code).toBe("auth.institutionInactive");
    expect((await request(app).post("/auth/session").send({ email: email(people.professor), password }).expect(403)).body.code).toBe("auth.institutionInactive");
    // Admins still see it (marked as deactivated) and can bring it back.
    const page = (await (await signIn(people.admin)).get(`/institutions/${ids.school}`).expect(200)).body;
    expect(page.institution).toMatchObject({ active: false });
    expect(page.institution.deactivatedAt).toBeTruthy();

    await owner.post(`/institutions/${ids.school}/status`).send({ active: true }).expect(200);
    await signIn(people.professor);
    await owner.post(`/institutions/${ids.school}/status`).send({ active: "no" }).expect(400);
  });
});
