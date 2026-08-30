import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Validated shape of `?page=&limit=` on `GET /songs`. Query string values
 * always arrive as strings — `@Type(() => Number)` converts them before
 * `class-validator` runs, which requires `transform: true` on the global
 * `ValidationPipe` (set in main.ts).
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 10;
}
