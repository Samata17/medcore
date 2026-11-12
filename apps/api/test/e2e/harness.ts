/**
 * End-to-end test harness.
 *
 * Each test file gets a FRESH copy of the fictional seed data in a separate
 * database (default: "medcore_test" next to your dev database), then boots the
 * real compiled API (dist/) on a random port. Your development data is never touched:
 * the harness refuses to run unless the database name ends in "_test".
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const API_DIR = resolve(__dirname, "../..");
const requireFromApi = createRequire(join(API_DIR, "package.json"));

export const PASSWORD = "Demo@12345";

function testDatabaseUrl() {
  if (existsSync(join(API_DIR, ".env"))) process.loadEnvFile(join(API_DIR, ".env"));
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return explicit;
  if (!process.env.DATABASE_URL) throw new Error("Set TEST_DATABASE_URL (or DATABASE_URL in apps/api/.env)");
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/medcore_test";
  return url.toString();
}

function dbName(url: string) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/** Creates the test database if needed, wipes it, applies migrations and loads the seed. */
async function resetTestDatabase(url: string) {
  const name = dbName(url);
  if (!/_test$/.test(name)) throw new Error(`Refusing to reset "${name}": test database names must end in _test`);
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsupported test database name "${name}"`);

  const { PrismaClient } = requireFromApi("@prisma/client") as typeof import("@prisma/client");
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const server = new PrismaClient({ datasourceUrl: admin.toString() });
  try {
    const found = await server.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM pg_database WHERE datname = '${name}'`);
    if (!found.length) await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await server.$disconnect();
  }

  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.$executeRawUnsafe(`CREATE SCHEMA public`);
  } finally {
    await db.$disconnect();
  }

  const env = { ...process.env, DATABASE_URL: url, SEED_PASSWORD: PASSWORD };
  const run = (args: string[]) => execFileSync(process.execPath, args, { cwd: API_DIR, env, stdio: "pipe" });
  run([requireFromApi.resolve("prisma/build/index.js"), "migrate", "deploy"]);
  run([requireFromApi.resolve("tsx/cli"), "prisma/seed.ts"]);
}

type Prisma = InstanceType<typeof import("@prisma/client").PrismaClient>;

export interface TestApp {
  origin: string;
  base: string;
  /** Direct access to the test database, for checks the API deliberately doesn't expose. */
  db: Prisma;
  close: () => Promise<void>;
}

export async function startTestApp(): Promise<TestApp> {
  const url = testDatabaseUrl();
  await resetTestDatabase(url);

  const uploads = mkdtempSync(join(tmpdir(), "medcore-e2e-"));
  Object.assign(process.env, {
    NODE_ENV: "test",
    TZ: process.env.APP_TIMEZONE || "Asia/Kolkata",
    DATABASE_URL: url,
    UPLOAD_DIR: uploads,
    WEB_ORIGIN: "http://localhost:3000",
    // Tests check the "not configured" behaviour, so local payment keys are ignored.
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: "",
    RAZORPAY_WEBHOOK_SECRET: "",
    SMTP_HOST: "",
  });
  delete process.env.REDIS_URL; // single instance → in-memory socket adapter

  const distEntry = join(API_DIR, "dist/app.setup.js");
  if (!existsSync(distEntry)) throw new Error("Build the API first: npm run build:api");
  const { createApp } = require(distEntry) as { createApp: (o: { logger?: false }) => Promise<{ listen: (p: number, h: string) => Promise<unknown>; getHttpServer: () => { address: () => { port: number } }; close: () => Promise<void> }> };
  const app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");
  const origin = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const { PrismaClient } = requireFromApi("@prisma/client") as typeof import("@prisma/client");
  const db = new PrismaClient({ datasourceUrl: url });

  return {
    origin,
    base: `${origin}/api/v1`,
    db,
    close: async () => {
      await db.$disconnect();
      await app.close();
      rmSync(uploads, { recursive: true, force: true });
    },
  };
}

/* ---------- Small HTTP client ---------- */

export interface CallResult<T = any> {
  status: number;
  json: any;
  data: T;
  msg?: string;
  headers: Headers;
}

export function client(base: string) {
  async function call<T = any>(
    path: string,
    opts: { method?: string; token?: string; body?: unknown; form?: FormData; cookie?: string; csrf?: boolean; headers?: Record<string, string> } = {},
  ): Promise<CallResult<T>> {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.csrf !== false) headers["x-medcore-csrf"] = "1";
    if (!opts.form && opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.cookie) headers.Cookie = opts.cookie;
    const res = await fetch(base + path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    const json: any = (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : null;
    return { status: res.status, json, data: json?.data, msg: json?.error?.message, headers: res.headers };
  }

  async function login(email: string, password = PASSWORD) {
    const r = await call<{ accessToken: string; user: { role: string } }>("/auth/login", { method: "POST", body: { email, password } });
    const cookie = r.headers.get("set-cookie") ?? "";
    return { token: r.data?.accessToken, refresh: /medcore_rt=([^;]*)/.exec(cookie)?.[1], setCookie: cookie, res: r };
  }

  return { call, login };
}
