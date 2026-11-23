import { InputType, PartialType } from '@nestjs/graphql';
import { CreateSongDto } from './create-song.dto';

/**
 * `CreateSongDto` with every field optional; used by `PUT /songs/:id` and
 * the `updateSong` mutation. This `PartialType` keeps the validation rules
 * but drops `@ApiProperty`, so the REST route documents its body with
 * `@ApiBody` instead.
 */
@InputType()
export class UpdateSongInput extends PartialType(CreateSongDto) {}
