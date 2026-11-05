import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';

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

  @IsString() @MinLength(32)
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
