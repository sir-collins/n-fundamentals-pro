import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Validated body of `PUT /prisma/songs/:id/lyrics`. */
export class UpsertLyricsDto {
  @ApiProperty({ example: "I've been tryna call..." })
  @IsString()
  @IsNotEmpty()
  readonly text!: string;
}
