import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PageQueryDto } from '../common/pagination.js';

export class ListActivityLogsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  actor_id?: string;

  @ApiPropertyOptional({ example: 'user.updated' }) @IsOptional() @IsString() @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ example: 'user' }) @IsOptional() @IsString() @MaxLength(50)
  entity_type?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(36)
  entity_id?: string;

  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsISO8601()
  to?: string;
}
