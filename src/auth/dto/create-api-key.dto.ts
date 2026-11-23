import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Body of `POST /auth/api-keys`. */
export class CreateApiKeyDto {
  @ApiPropertyOptional({
    description: "A caller-chosen label for this key, e.g. 'CI pipeline'",
  })
  @IsOptional()
  @IsString()
  readonly label?: string;
}
