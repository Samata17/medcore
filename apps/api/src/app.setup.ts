import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { allowedOrigins, env } from "./config/env";
import { validationExceptionFactory } from "./common/http";
import { RedisIoAdapter } from "./common/redis-io.adapter";

/**
 * Builds the fully configured app (security headers, CORS, validation, docs).
 * Used by main.ts and by the end-to-end tests, so tests exercise the real setup.
 */
export async function createApp(options: { logger?: false } = {}) {
  const config = env(); // fail fast on bad configuration
  // rawBody is kept so payment webhooks can verify their HMAC signatures.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
    ...(options.logger === false ? { logger: false } : {}),
  });
  const io = new RedisIoAdapter(app);
  await io.connect(config.REDIS_URL);
  app.useWebSocketAdapter(io);

  // Correct client IPs behind proxies (Render/Railway/AWS ALB, + Vercel for the sign-in proxy).
  app.set("trust proxy", config.TRUST_PROXY);
  app.disable("x-powered-by");
  // Secure headers everywhere; the Swagger UI page needs inline scripts, so CSP is relaxed only there.
  const strict = helmet();
  const docs = helmet({ contentSecurityPolicy: false });
  app.use((req: { path: string }, res: unknown, next: () => void) =>
    (req.path.startsWith("/api/docs") ? docs : strict)(req as never, res as never, next),
  );
  app.use(cookieParser());
  app.useBodyParser("json", { limit: "1mb" });

  // Strict CORS: only the configured web origin(s), with credentials for the refresh cookie.
  const origins = allowedOrigins();
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-medcore-csrf"],
    maxAge: 600,
  });

  app.setGlobalPrefix("api/v1", { exclude: ["api/docs"] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // …and reject requests that send them
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle("MedCore HMS API")
    .setDescription(
      "REST API for MedCore HMS. Responses use `{ success, data, meta? }`; errors use `{ success: false, error }`. " +
        "Sign in with POST /auth/login, then click Authorize and paste the accessToken.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: false },
  });

  app.enableShutdownHooks();
  return app;
}
