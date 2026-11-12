import "reflect-metadata";
import { existsSync } from "node:fs";

// Load apps/api/.env (Node ≥ 20.12) before anything reads process.env.
// In Docker/cloud hosting there is no .env file; variables come from the platform.
if (existsSync(".env")) process.loadEnvFile(".env");
// Doctor hours ("09:00") and "today" are hospital local time, regardless of the server's own clock.
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

import { Logger } from "@nestjs/common";
import { createApp } from "./app.setup";
import { env } from "./config/env";

async function bootstrap() {
  const app = await createApp();
  const port = env().API_PORT;
  // 0.0.0.0 so the API is reachable inside a container.
  await app.listen(port, "0.0.0.0");
  const log = new Logger("Bootstrap");
  log.log(`API ready on http://localhost:${port}/api/v1`);
  log.log(`Swagger docs on http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
