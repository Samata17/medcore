import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  StreamableFile,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { map } from "rxjs";

/** Return this from a controller to include pagination metadata. */
export class Paginated<T> {
  constructor(
    public readonly data: T[],
    public readonly meta: { page: number; pageSize: number; total: number; totalPages: number },
  ) {}
  static of<T>(data: T[], total: number, page: number, pageSize: number) {
    return new Paginated(data, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  }
}

/** Wraps every successful response as `{ success: true, data, meta? }`. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((result: unknown) =>
        result instanceof StreamableFile
          ? result // file downloads are sent as-is
          : result instanceof Paginated
            ? { success: true, data: result.data, meta: result.meta }
            : { success: true, data: result ?? null },
      ),
    );
  }
}

/**
 * Turns every error into `{ success: false, error: { statusCode, message, details? } }`.
 * Database and unexpected errors are logged but never leaked to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong. Please try again.";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") message = body;
      else if (body && typeof body === "object") {
        const b = body as { message?: string | string[]; details?: unknown };
        if (Array.isArray(b.message)) {
          message = "Please correct the highlighted fields.";
          details = b.message;
        } else if (b.message) message = b.message;
        if (b.details) details = b.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "A record with these details already exists.";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "Record not found.";
      } else {
        this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
      }
    } else if (isClientHttpError(exception)) {
      // Errors raised by Express middleware before our code runs (e.g. body-parser).
      status = exception.status;
      message =
        exception.type === "entity.too.large"
          ? "The request is too large."
          : exception.type === "entity.parse.failed"
            ? "The request body isn't valid JSON."
            : "The request couldn't be processed.";
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({ success: false, error: { statusCode: status, message, ...(details ? { details } : {}) } });
  }
}

/** http-errors style objects with a safe 4xx status (`expose` means the message is client-safe). */
function isClientHttpError(e: unknown): e is { status: number; type?: string } {
  const x = e as { status?: unknown; expose?: unknown } | null;
  return !!x && typeof x.status === "number" && x.status >= 400 && x.status < 500 && x.expose === true;
}

/** Validation errors from class-validator, returned as 422 with per-field messages. */
export function validationExceptionFactory(errors: import("class-validator").ValidationError[]) {
  const details: Record<string, string[]> = {};
  const walk = (errs: import("class-validator").ValidationError[], prefix = "") => {
    for (const e of errs) {
      const key = prefix ? `${prefix}.${e.property}` : e.property;
      if (e.constraints) details[key] = Object.values(e.constraints);
      if (e.children?.length) walk(e.children, key);
    }
  };
  walk(errors);
  return new UnprocessableEntityException({ message: "Please correct the highlighted fields.", details });
}
