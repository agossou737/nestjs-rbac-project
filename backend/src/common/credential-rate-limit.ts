import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const CREDENTIAL_ROUTE = 'credentialRateLimit';
const reflector = new Reflector();

// Marks the routes that take credentials or reset tokens: they get the strict "auth" limit on top of the global one.
export const CredentialRateLimit = () => SetMetadata(CREDENTIAL_ROUTE, true);

// Per-IP limits. shortcut: in-memory store, so each API replica counts on its own; move to a shared store if scaled out.
export function throttlerOptions(config: ConfigService): ThrottlerModuleOptions {
  return [
    {
      name: 'default',
      limit: config.getOrThrow<number>('GLOBAL_THROTTLE_LIMIT'),
      ttl: 60_000,
    },
    {
      name: 'auth',
      limit: config.getOrThrow<number>('AUTH_THROTTLE_LIMIT'),
      ttl: config.getOrThrow<number>('AUTH_THROTTLE_TTL_SECONDS') * 1000,
      skipIf: (context: ExecutionContext) => !reflector.get<boolean>(CREDENTIAL_ROUTE, context.getHandler()),
    },
  ];
}
