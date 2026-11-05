import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  type ValidationError,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

const PRISMA_STATUS: Record<string, { status: number; detail: string }> = {
  P2002: { status: HttpStatus.CONFLICT, detail: 'A resource with the same unique value already exists' },
  P2025: { status: HttpStatus.NOT_FOUND, detail: 'Resource not found' },
};

export type FieldError = { field: string; rule: string; message: string };

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: FieldError[];
};

export class ValidationProblemException extends BadRequestException {
  constructor(readonly fieldErrors: FieldError[]) {
    super('The request contains invalid fields');
  }
}

// ValidationPipe exceptionFactory: nested properties are reported with a dotted path (roles.0.id).
export function toValidationProblem(errors: ValidationError[]): ValidationProblemException {
  const flatten = (list: ValidationError[], prefix = ''): FieldError[] =>
    list.flatMap((error) => {
      const field = prefix + error.property;
      const own = Object.entries(error.constraints ?? {}).map(([rule, message]) => ({ field, rule, message }));
      return [...own, ...flatten(error.children ?? [], `${field}.`)];
    });
  return new ValidationProblemException(flatten(errors));
}

// RFC 9457: one shape for every error, never a stack trace, SQL or internal detail.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = this.toProblem(exception, request.originalUrl.split('?')[0]);
    if (problem.status >= 500) {
      this.logger.error(`Unhandled error on ${request.method} ${problem.instance}`, (exception as Error)?.stack);
    }
    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, instance: string): ProblemDetails {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const problem: ProblemDetails = {
        type: 'about:blank',
        title: statusTitle(status),
        status,
        detail: detailOf(exception),
        instance,
      };
      if (exception instanceof ValidationProblemException) problem.errors = exception.fieldErrors;
      return problem;
    }
    // A unique index wins a race the service pre-checks could not see.
    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code in PRISMA_STATUS) {
      const { status, detail } = PRISMA_STATUS[exception.code];
      return { type: 'about:blank', title: statusTitle(status), status, detail, instance };
    }
    return {
      type: 'about:blank',
      title: statusTitle(HttpStatus.INTERNAL_SERVER_ERROR),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred',
      instance,
    };
  }
}

function detailOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  const message = (body as { message?: unknown }).message;
  return Array.isArray(message) ? message.join('; ') : typeof message === 'string' ? message : exception.message;
}

function statusTitle(status: number): string {
  const name = HttpStatus[status];
  if (!name) return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
