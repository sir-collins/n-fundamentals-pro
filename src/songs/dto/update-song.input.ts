import { InputType, PartialType } from '@nestjs/graphql';
import { CreateSongDto } from './create-song-dto';

/**
 * The `updateSong` mutation's input — every `CreateSongDto` field made
 * optional. `@nestjs/graphql`'s `PartialType` (not TypeScript's own
 * `Partial<T>`) generates a real GraphQL input type with each field
 * genuinely optional in the schema, not just a compile-time type alias.
 */
@InputType()
export class UpdateSongInput extends PartialType(CreateSongDto) {}
