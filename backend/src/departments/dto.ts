import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { SortOrderDto } from '../common/pagination.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upperCode = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export const DEPARTMENT_SORT_FIELDS = ['name', 'code', 'created_at'] as const;

export class ListDepartmentsQueryDto extends SortOrderDto {
  @ApiPropertyOptional({ description: 'Searches code and name' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: DEPARTMENT_SORT_FIELDS }) @IsOptional() @IsIn(DEPARTMENT_SORT_FIELDS)
  sort?: (typeof DEPARTMENT_SORT_FIELDS)[number];
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'DSI', description: 'Short code, upper-cased: letters, digits, dash and underscore' })
  @Transform(upperCode) @IsString() @Matches(/^[A-Z0-9_-]{2,20}$/, { message: 'code must be 2 to 20 letters, digits, - or _' })
  code!: string;

  @ApiProperty({ example: 'Direction des systèmes d’information' })
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  description?: string;

  // null detaches the manager; absent leaves it as it is.
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional() @ValidateIf((_dto, value) => value !== null) @IsUUID()
  manager_id?: string | null;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'DSI' })
  @IsOptional() @Transform(upperCode) @IsString() @Matches(/^[A-Z0-9_-]{2,20}$/, { message: 'code must be 2 to 20 letters, digits, - or _' })
  code?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional() @ValidateIf((_dto, value) => value !== null) @IsUUID()
  manager_id?: string | null;
}
