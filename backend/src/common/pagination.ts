import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  page_size: number = 20;
}

export class SortOrderDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional() @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

// List shape of the API (ADR 0001): offset pagination with the total, for numbered table pages.
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export function pageArgs(query: PageQueryDto) {
  return { skip: (query.page - 1) * query.page_size, take: query.page_size };
}

export function toPage<T>(items: T[], total: number, query: PageQueryDto): Page<T> {
  return { items, total, page: query.page, page_size: query.page_size };
}
