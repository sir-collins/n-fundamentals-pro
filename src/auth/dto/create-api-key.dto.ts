import { IsOptional, IsString } from 'class-validator';

/** Validated shape of a `POST /auth/api-keys` request body. */
export class CreateApiKeyDto {
  @IsOptional()
  @IsString()
  readonly label?: string;
}
