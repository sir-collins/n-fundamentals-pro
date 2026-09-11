import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Validated shape of a `POST /auth/api-keys` request body. */
export class CreateApiKeyDto {
  @ApiPropertyOptional({
    description: "A caller-chosen label for this key, e.g. 'CI pipeline'",
  })
  @IsOptional()
  @IsString()
  readonly label?: string;
}
