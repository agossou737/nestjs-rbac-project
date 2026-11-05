import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SortOrderDto } from '../common/pagination.js';
import { ALL_PERMISSION_KEYS, type PermissionKey } from '../rbac/permission-catalog.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const ROLE_SORT_FIELDS = ['name', 'created_at'] as const;

export class ListRolesQueryDto extends SortOrderDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ROLE_SORT_FIELDS }) @IsOptional() @IsIn(ROLE_SORT_FIELDS)
  sort?: (typeof ROLE_SORT_FIELDS)[number];
}

export class PermissionKeysDto {
  @ApiProperty({ type: [String], enum: ALL_PERMISSION_KEYS })
  @IsArray() @ArrayUnique() @IsIn(ALL_PERMISSION_KEYS, { each: true })
  permissions!: PermissionKey[];
}

export class CreateRoleDto extends PermissionKeysDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(50)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  description?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(50)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  description?: string;
}

export class DuplicateRoleDto {
  @ApiPropertyOptional({ description: 'Defaults to "<name> (copie)"' })
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(50)
  name?: string;
}
