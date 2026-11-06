import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SortOrderDto } from '../common/pagination.js';
import { UserStatus } from '../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const USER_SORT_FIELDS = ['created_at', 'email', 'last_name', 'last_login_at', 'status'] as const;

export class ListUsersQueryDto extends SortOrderDto {
  @ApiPropertyOptional({ description: 'Searches email, first name and last name' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  role_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  department_id?: string;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS }) @IsOptional() @IsIn(USER_SORT_FIELDS)
  sort?: (typeof USER_SORT_FIELDS)[number];
}

class UserProfileFields {
  @ApiProperty() @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;

  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  first_name!: string;

  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  last_name!: string;
}

export class RoleIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true })
  role_ids!: string[];
}

export class CreateUserDto extends UserProfileFields {
  @ApiPropertyOptional({ type: [String], description: 'Roles to assign; the account is invited by email' })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true })
  role_ids?: string[];

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  department_id?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  first_name?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  last_name?: string;

  // null detaches the account from its department; absent leaves it as it is.
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional() @ValidateIf((_dto, value) => value !== null) @IsUUID()
  department_id?: string | null;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: UserStatus }) @IsEnum(UserStatus)
  status!: UserStatus;
}
