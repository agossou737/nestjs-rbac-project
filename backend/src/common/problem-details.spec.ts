import { type ArgumentsHost, ForbiddenException, type ValidationError } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ProblemDetailsFilter, type ProblemDetails, toValidationProblem } from './problem-details.js';

function hostFor(url: string) {
  const sent: { status?: number; type?: string; body?: ProblemDetails } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    type(value: string) {
      sent.type = value;
      return this;
    },
    json(body: ProblemDetails) {
      sent.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl: url }), getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, sent };
}

describe('ProblemDetailsFilter', () => {
  const filter = new ProblemDetailsFilter();

  it('turns an HttpException into RFC 9457 problem+json without the query string', () => {
    const { host, sent } = hostFor('/api/v1/users?search=secret');
    filter.catch(new ForbiddenException('No access'), host);
    expect(sent).toEqual({
      status: 403,
      type: 'application/problem+json',
      body: { type: 'about:blank', title: 'Forbidden', status: 403, detail: 'No access', instance: '/api/v1/users' },
    });
  });

  it.each([
    ['P2002', 409],
    ['P2025', 404],
  ])('maps the Prisma error %s to %i', (code, status) => {
    const { host, sent } = hostFor('/api/v1/roles');
    filter.catch(new Prisma.PrismaClientKnownRequestError('db detail with SQL', { code, clientVersion: 'test' }), host);
    expect(sent.status).toBe(status);
    expect(JSON.stringify(sent.body)).not.toContain('SQL');
  });

  it('hides any internal detail of an unexpected error behind a generic 500', () => {
    const { host, sent } = hostFor('/api/v1/dashboard');
    const logger = vi.spyOn((filter as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => {});
    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2'), host);
    expect(sent.status).toBe(500);
    expect(sent.body?.detail).toBe('An unexpected error occurred');
    expect(JSON.stringify(sent.body)).not.toMatch(/ECONNREFUSED|hunter2/);
    expect(logger).toHaveBeenCalledOnce();
  });
});

describe('toValidationProblem', () => {
  it('flattens nested validation errors with a dotted field path', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
      { property: 'roles', children: [{ property: '0', constraints: { isUuid: 'must be a UUID' }, children: [] }] },
    ];
    expect(toValidationProblem(errors).fieldErrors).toEqual([
      { field: 'email', rule: 'isEmail', message: 'email must be an email' },
      { field: 'roles.0', rule: 'isUuid', message: 'must be a UUID' },
    ]);
  });
});
