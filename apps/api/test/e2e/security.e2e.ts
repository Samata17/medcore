/**
 * Security & access-control tests against the real API (fresh fictional seed).
 * Run with: npm run test:e2e
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { client, PASSWORD, startTestApp, type TestApp } from "./harness";

let app: TestApp;
let api: ReturnType<typeof client>;

before(async () => {
  app = await startTestApp();
  api = client(app.base);
});
after(() => app?.close());

describe("platform", () => {
  it("health check reports the database", async () => {
    const r = await api.call("/health");
    assert.equal(r.status, 200);
    assert.equal(r.data.database, "up");
  });

  it("serves Swagger docs and the OpenAPI JSON", async () => {
    assert.equal((await fetch(`${app.origin}/api/docs`)).status, 200);
    const spec = (await (await fetch(`${app.origin}/api/docs-json`)).json()) as { paths: Record<string, unknown> };
    assert.ok(Object.keys(spec.paths).length > 40, "most endpoints are documented");
  });

  it("sends security headers and hides the framework", async () => {
    const res = await fetch(`${app.base}/health`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.ok(res.headers.get("content-security-policy"));
    assert.ok(res.headers.get("strict-transport-security"));
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  it("CORS allows only the configured web origin", async () => {
    const pre = (origin: string) =>
      fetch(`${app.base}/auth/login`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
    assert.equal((await pre("http://localhost:3000")).headers.get("access-control-allow-origin"), "http://localhost:3000");
    assert.equal((await pre("https://evil.example")).headers.get("access-control-allow-origin"), null);
  });

  it("unknown routes return the standard error envelope", async () => {
    const r = await api.call("/does-not-exist");
    assert.equal(r.status, 404);
    assert.equal(r.json.success, false);
    assert.equal(r.json.error.statusCode, 404);
  });

  it("rejects oversized JSON bodies", async () => {
    const r = await api.call("/auth/login", { method: "POST", body: { email: "a@b.test", password: "x".repeat(2 * 1024 * 1024) } });
    assert.equal(r.status, 413);
    assert.equal(r.json.success, false);
  });

  it("rejects malformed JSON with 400, not a server error", async () => {
    const res = await fetch(`${app.base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"email": ' });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { success: boolean }).success, false);
  });
});

describe("authentication", () => {
  it("gives the same error for a wrong password and an unknown email", async () => {
    const wrong = await api.login("kavita.sharma@sunrise.test", "Wrong@1234");
    const unknown = await api.login("nobody@sunrise.test", "Wrong@1234");
    assert.equal(wrong.res.status, 401);
    assert.equal(unknown.res.status, 401);
    assert.equal(wrong.res.msg, "Incorrect email or password");
    assert.equal(unknown.res.msg, wrong.res.msg);
  });

  it("returns a token, an HttpOnly path-scoped refresh cookie and no secrets", async () => {
    const s = await api.login("kavita.sharma@sunrise.test");
    assert.ok(s.token);
    assert.equal(s.res.data.user.role, "DOCTOR");
    assert.match(s.setCookie, /HttpOnly/i);
    assert.match(s.setCookie, /Path=\/api\/v1\/auth/i);
    assert.match(s.setCookie, /SameSite=Lax/i);
    assert.doesNotMatch(JSON.stringify(s.res.json), /passwordHash|tokenHash/);
  });

  it("rejects missing, malformed, forged and wrong-algorithm tokens", async () => {
    assert.equal((await api.call("/patients")).status, 401);
    assert.equal((await api.call("/patients", { token: "not-a-jwt" })).status, 401);
    const { token } = await api.login("arjun.nair@sunrise.test");
    const [h, p] = token!.split(".");
    const body = JSON.parse(Buffer.from(p, "base64url").toString());
    const elevated = Buffer.from(JSON.stringify({ ...body, role: "SUPER_ADMIN" })).toString("base64url");
    assert.equal((await api.call("/hospitals", { token: `${h}.${elevated}.${token!.split(".")[2]}` })).status, 401, "edited payload");
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    assert.equal((await api.call("/patients", { token: `${none}.${p}.` })).status, 401, "alg=none");
  });

  it("blocks sign-in for a hospital that isn't verified yet", async () => {
    const r = await api.login("admin@lakeview.test");
    assert.equal(r.res.status, 403);
  });

  it("locks the account for 15 minutes after 5 failed attempts", async () => {
    const email = "meera.pillai@sunrise.test";
    const codes: number[] = [];
    let fifthAt = 0;
    for (let i = 0; i < 5; i++) {
      if (i === 4) fifthAt = Date.now();
      codes.push((await api.login(email, "Wrong@1234")).res.status);
    }
    assert.deepEqual(codes, [401, 401, 401, 401, 401]);
    const user = await app.db.user.findUnique({ where: { email }, select: { lockedUntil: true } });
    const minutes = (user!.lockedUntil!.getTime() - fifthAt) / 60_000;
    assert.ok(minutes >= 15 && minutes < 16, `locked for ${minutes.toFixed(1)} min after the 5th failure`);
    // The next attempt — even with the right password — is refused (by the lock or the rate limit).
    const r = await api.login(email, PASSWORD);
    assert.ok([403, 429].includes(r.res.status), `status ${r.res.status}`);
    assert.equal(r.token, undefined);
  });

  it("rate-limits repeated credential attempts per account", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await api.login("ratelimit@sunrise.test", "Wrong@1234")).res.status);
    assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(codes[5], 429);
    // A different account from the same IP (e.g. a shared hospital network) is unaffected.
    assert.equal((await api.login("vikram.desai@sunrise.test")).res.status, 200);
  });
});

describe("refresh tokens", () => {
  it("require the CSRF header", async () => {
    const s = await api.login("pooja.iyer@sunrise.test");
    const r = await api.call("/auth/refresh", { method: "POST", cookie: `medcore_rt=${s.refresh}`, csrf: false });
    assert.equal(r.status, 403);
  });

  it("rotate on every use; reusing an old one revokes the whole session", async () => {
    const s = await api.login("kavita.sharma@sunrise.test");
    const r1 = await api.call("/auth/refresh", { method: "POST", cookie: `medcore_rt=${s.refresh}` });
    const rotated = /medcore_rt=([^;]*)/.exec(r1.headers.get("set-cookie") ?? "")?.[1];
    assert.equal(r1.status, 200);
    assert.ok(r1.data.accessToken);
    assert.ok(rotated && rotated !== s.refresh);
    assert.equal((await api.call("/auth/refresh", { method: "POST", cookie: `medcore_rt=${s.refresh}` })).status, 401, "old token reused");
    assert.equal((await api.call("/auth/refresh", { method: "POST", cookie: `medcore_rt=${rotated}` })).status, 401, "family revoked");
  });

  it("are revoked by logout", async () => {
    const s = await api.login("arjun.nair@sunrise.test");
    await api.call("/auth/logout", { method: "POST", cookie: `medcore_rt=${s.refresh}` });
    assert.equal((await api.call("/auth/refresh", { method: "POST", cookie: `medcore_rt=${s.refresh}` })).status, 401);
  });
});

describe("role-based access and tenant isolation", () => {
  let doctor: string, metroAdmin: string, patient: string, superAdmin: string, sunrisePatientId: string;
  before(async () => {
    [doctor, metroAdmin, patient, superAdmin] = (
      await Promise.all(["kavita.sharma@sunrise.test", "ravi.menon@metroheart.test", "rohan.kulkarni@patient.test", "superadmin@medcore.test"].map((e) => api.login(e)))
    ).map((s) => s.token!);
  });

  it("staff see only their own hospital's patients", async () => {
    const own = await api.call("/patients", { token: doctor });
    const other = await api.call("/patients", { token: metroAdmin });
    assert.equal(own.status, 200);
    assert.equal(own.json.success, true);
    assert.equal(own.json.meta.total, 14);
    assert.equal(other.json.meta.total, 6);
    sunrisePatientId = own.data[0].id;
    assert.ok(!other.data.some((p: { id: string }) => p.id === sunrisePatientId));
  });

  it("another hospital gets 404 for this hospital's records", async () => {
    assert.equal((await api.call(`/patients/${sunrisePatientId}`, { token: metroAdmin })).status, 404);
    // A doctor (who may read records) at another hospital still can't see this one.
    const metroDoctor = (await api.login("anjali.rao@metroheart.test")).token;
    assert.ok(metroDoctor);
    assert.equal((await api.call(`/patients/${sunrisePatientId}/record`, { token: metroDoctor })).status, 404);
    assert.equal((await api.call(`/patients/${sunrisePatientId}/vitals`, { method: "POST", token: metroDoctor, body: { pulse: 80 } })).status, 404);
  });

  it("platform endpoints are super-admin only", async () => {
    assert.equal((await api.call("/hospitals", { token: doctor })).status, 403);
    const all = await api.call("/hospitals", { token: superAdmin });
    assert.equal(all.status, 200);
    assert.equal(all.data.length, 3);
  });

  it("patients can't list patients or read another patient's record", async () => {
    assert.equal((await api.call("/patients", { token: patient })).status, 403);
    assert.equal((await api.call(`/patients/${sunrisePatientId}/record`, { token: patient })).status, 403);
    assert.equal((await api.call("/billing/invoices", { token: patient })).status, 403);
    assert.equal((await api.call("/audit-logs", { token: patient })).status, 403);
  });

  it("doctor slot lists don't expose patient details", async () => {
    const doctors = await api.call("/doctors", { token: patient });
    assert.equal(doctors.data.length, 6);
    const slots = await api.call(`/doctors/${doctors.data[0].id}/appointments`, { token: patient });
    assert.equal(slots.status, 200);
    assert.doesNotMatch(JSON.stringify(slots.json), /patient|Kulkarni|mrn/i);
  });

  it("rejects non-UUID ids instead of passing them to the database", async () => {
    const r = await api.call("/patients/1%27%20OR%20%271%27=%271", { token: doctor });
    assert.equal(r.status, 400);
  });
});

describe("input validation", () => {
  let reception: string;
  before(async () => {
    reception = (await api.login("arjun.nair@sunrise.test")).token!;
  });

  it("returns 422 with per-field details", async () => {
    const r = await api.call("/patients", { method: "POST", token: reception, body: { firstName: "A", lastName: "", gender: "X", dateOfBirth: "nope", phone: "12", allergies: [] } });
    assert.equal(r.status, 422);
    assert.ok(r.json.error.details.firstName);
    assert.ok(r.json.error.details.phone);
  });

  it("rejects injected fields such as hospitalId", async () => {
    const r = await api.call("/patients", {
      method: "POST",
      token: reception,
      body: { firstName: "Test", lastName: "Patient", gender: "FEMALE", dateOfBirth: "1990-01-01", phone: "+919000099999", allergies: [], hospitalId: "evil" },
    });
    assert.equal(r.status, 422);
  });

  it("registers a valid patient with a generated MRN; duplicate phone → 409", async () => {
    const body = { firstName: "Test", lastName: "Patient", gender: "FEMALE", dateOfBirth: "1990-01-01", phone: "+91 90000 99999", allergies: ["Dust"] };
    const ok = await api.call("/patients", { method: "POST", token: reception, body });
    assert.equal(ok.status, 201);
    assert.match(ok.data.mrn, /^MC-\d{6}$/);
    const dup = await api.call("/patients", { method: "POST", token: reception, body: { ...body, firstName: "Other", phone: "+919000099999" } });
    assert.equal(dup.status, 409);
  });

  it("stores text safely (no HTML interpretation server-side)", async () => {
    const r = await api.call("/patients", {
      method: "POST",
      token: reception,
      body: { firstName: "<script>x</script>", lastName: "Patient", gender: "MALE", dateOfBirth: "1990-01-01", phone: "+919000088888", allergies: [] },
    });
    // Either refused by validation, or stored as plain text that React escapes on display.
    assert.ok(r.status === 422 || (r.status === 201 && r.data.name.includes("<script>")), `status ${r.status}`);
  });

  it("blocks UPDATE and DELETE on clinical records and the audit log at database level", async () => {
    for (const table of ["Vital", "Diagnosis", "ClinicalNote", "AuditLog"]) {
      const [{ n }] = await app.db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}"`);
      assert.ok(n > 0n, `${table} has seed rows to protect`);
      await assert.rejects(app.db.$executeRawUnsafe(`TRUNCATE "${table}" CASCADE`), /append-only/, `${table} TRUNCATE`);
      await assert.rejects(app.db.$executeRawUnsafe(`UPDATE "${table}" SET "id" = "id"`), /append-only/, `${table} UPDATE`);
      await assert.rejects(app.db.$executeRawUnsafe(`DELETE FROM "${table}"`), /append-only/, `${table} DELETE`);
    }
    assert.ok((await app.db.vital.count()) > 0, "rows still there");
  });

  it("records logins, failures and patient creation in the audit log", async () => {
    const { token } = await api.login("superadmin@medcore.test");
    const logs = await api.call("/audit-logs", { token });
    const actions = new Set(logs.data.map((a: { action: string }) => a.action));
    assert.ok(actions.has("PATIENT_CREATE"));
    assert.ok(actions.has("LOGIN_FAILED"));
  });
});
