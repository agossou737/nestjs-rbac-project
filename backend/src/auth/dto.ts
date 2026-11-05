import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './passwords.js';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class LoginDto {
  @ApiProperty({ example: 'admin@example.org' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // No length rule on login: a policy change must not lock out existing passwords.
  @ApiProperty({ format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@example.org' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token received by email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ format: 'password', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class UserSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() first_name!: string;
  @ApiProperty() last_name!: string;
}

export class TokenResponseDto {
  @ApiProperty() access_token!: string;
  @ApiProperty({ example: 'Bearer' }) token_type!: 'Bearer';
  @ApiProperty({ example: 900 }) expires_in!: number;
  @ApiProperty({ type: UserSummaryDto }) user!: UserSummaryDto;
}

export class RoleRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class MeDto extends UserSummaryDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'LOCKED'] }) status!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) last_login_at!: string | null;
  @ApiProperty({ type: [RoleRefDto] }) roles!: RoleRefDto[];
  @ApiProperty({ type: [String], example: ['users.read'] }) permissions!: string[];
}

export class MessageDto {
  @ApiProperty() message!: string;
}
