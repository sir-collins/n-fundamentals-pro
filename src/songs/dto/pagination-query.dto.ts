import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Validated shape of `?page=&limit=` on `GET /songs` — reused directly
 * as the GraphQL `songs` query's arguments via `@ArgsType()`. Query
 * string values always arrive as strings — `@Type(() => Number)`
 * converts them before `class-validator` runs, which requires
 * `transform: true` on the global `ValidationPipe` (set in main.ts).
 */
@ArgsType()
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 10;
}
