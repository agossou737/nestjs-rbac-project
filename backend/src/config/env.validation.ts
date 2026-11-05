// class-transformer reads design:type metadata: this module must not rely on Nest having loaded the polyfill.
import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

// Reads the raw value: implicit conversion has already turned the string "false" into true (Boolean("false")).
const toBoolean = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key] === true || obj[key] === 'true';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString() @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString() @IsNotEmpty()
  CORS_ORIGINS!: string;

  @IsString() @IsNotEmpty()
  APP_URL!: string;

  // 256 bits at least (64 hex or 43 base64 characters), and never the placeholder of .env.example.
  @IsString() @MinLength(43) @Matches(/^(?!change-me)/, { message: 'JWT_ACCESS_SECRET still holds the .env.example placeholder' })
  JWT_ACCESS_SECRET!: string;

  @IsInt() @Min(60) @Max(3600)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsInt() @Min(1) @Max(90)
  REFRESH_TOKEN_TTL_DAYS: number = 7;

  @Transform(toBoolean) @IsBoolean()
  COOKIE_SECURE: boolean = true;

  @IsInt() @Min(1)
  LOGIN_MAX_ATTEMPTS: number = 5;

  @IsInt() @Min(1)
  LOGIN_LOCK_MINUTES: number = 15;

  // Failures on one account from all IPs together before the whole account locks (distributed attack).
  @IsInt() @Min(1)
  LOGIN_ACCOUNT_MAX_ATTEMPTS: number = 50;

  @IsInt() @Min(1)
  AUTH_THROTTLE_LIMIT: number = 10;

  @IsInt() @Min(1)
  AUTH_THROTTLE_TTL_SECONDS: number = 60;

  @IsInt() @Min(5) @Max(1440)
  PASSWORD_RESET_TTL_MINUTES: number = 30;

  @IsString() @IsNotEmpty()
  SMTP_HOST!: string;

  @IsInt() @Min(1) @Max(65535)
  SMTP_PORT!: number;

  @IsString() @IsNotEmpty()
  MAIL_FROM!: string;

  @Transform(toBoolean) @IsBoolean()
  SMTP_SECURE: boolean = false;

  // STARTTLS required: reset links must not cross the network in clear text outside a workstation.
  @Transform(toBoolean) @IsBoolean()
  SMTP_REQUIRE_TLS: boolean = false;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';

  @IsInt() @Min(1)
  GLOBAL_THROTTLE_LIMIT: number = 300;

  // Express "trust proxy": false, a hop count (1 behind one ingress) or a list of proxy addresses.
  @IsString() @IsNotEmpty()
  TRUST_PROXY: string = 'false';

  @Transform(toBoolean) @IsBoolean()
  SWAGGER_ENABLED: boolean = true;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const fields = errors.map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration\n${fields.join('\n')}`);
  }
  return env;
}
