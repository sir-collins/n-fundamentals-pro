// Pulls in @types/multer's global `Express.Multer.File` explicitly. Type
// only, nothing at runtime: relying on automatic @types inclusion left the
// editor unable to find it, even though tsc could.
/// <reference types="multer" />
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { extname } from 'path';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Put,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AvatarStorageService } from './avatar-storage.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  detectImageType,
  ImageSignatureValidator,
} from '../common/validators/image-signature.validator';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  /**
   * Upload or replace the caller's avatar (PNG, JPEG or WebP, up to 2 MB).
   *
   * The size is limited twice on purpose. Multer's `limits.fileSize` stops
   * reading the upload as soon as it passes 2 MB (a 413), so a huge file
   * is never buffered whole. `MaxFileSizeValidator` would only check after
   * buffering, but gives a clear message if the limits ever drift apart.
   * The type check reads the file's bytes, never the client's claimed type
   * or filename, and the stored extension comes from the detected type.
   * @throws BadRequestException if the file is missing or not a real image.
   * @throws PayloadTooLargeException if the file is over 2 MB.
   */
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Upload or replace the caller's avatar (PNG/JPEG/WebP, ≤ 2 MB).",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
      required: ['avatar'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar stored.',
    schema: {
      properties: { avatarUrl: { type: 'string' } },
      example: { avatarUrl: '/users/1/avatar' },
    },
  })
  @ApiResponse({ status: 400, description: 'Missing file or not an image.' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT.' })
  @ApiResponse({ status: 413, description: 'File over 2 MB.' })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: MAX_AVATAR_BYTES } }),
  )
  @Put('me/avatar')
  async uploadAvatar(
    @CurrentUser('id') userId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AVATAR_BYTES }),
          new ImageSignatureValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    // Non-null: ImageSignatureValidator already accepted these bytes.
    const { ext } = detectImageType(file.buffer)!;
    const filename = await this.avatarStorage.save(userId, file.buffer, ext);
    const result = await this.usersService.setAvatarPath(userId, filename);

    if (!result) {
      // The token outlived its user: don't leave the new file behind.
      await this.avatarStorage.remove(filename);
      throw new UnauthorizedException('User no longer exists');
    }

    if (result.previous) {
      await this.avatarStorage.remove(result.previous);
    }

    return { avatarUrl: `/users/${userId}/avatar` };
  }

  /**
   * A user's avatar image, streamed from disk. Public, like song reads.
   * @throws NotFoundException if the user doesn't exist or has no avatar.
   */
  @ApiOperation({ summary: "A user's avatar image. Public." })
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiResponse({
    status: 200,
    description: 'The image bytes, with a matching Content-Type.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 404, description: 'No such user, or no avatar.' })
  @Get(':id/avatar')
  async getAvatar(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const user = await this.usersService.findById(id);

    if (!user?.avatarPath) {
      throw new NotFoundException(`User with id ${id} has no avatar`);
    }

    const path = this.avatarStorage.pathFor(user.avatarPath);

    try {
      await access(path);
    } catch {
      // The row points at a file that's gone (e.g. a wiped disk).
      throw new NotFoundException(`User with id ${id} has no avatar`);
    }

    return new StreamableFile(createReadStream(path), {
      type: CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
    });
  }
}
