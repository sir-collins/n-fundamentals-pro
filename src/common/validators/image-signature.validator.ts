import { FileValidator } from '@nestjs/common';
import type { IFile } from '@nestjs/common/pipes/file/interfaces';

/** An image format this app accepts, as detected from its bytes. */
export interface ImageType {
  ext: 'png' | 'jpg' | 'webp';
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Identify a PNG, JPEG or WebP from its first bytes (its "magic numbers"),
 * ignoring whatever filename or type the client claimed.
 * @returns the detected type, or `null` for anything else.
 */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ext: 'png', mime: 'image/png' };
  }

  if (buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // RIFF container: "RIFF", 4 bytes of size, then the format "WEBP".
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
}

/**
 * `ParseFilePipe` validator: accepts only real PNG/JPEG/WebP bytes, never
 * trusting the client's mimetype.
 *
 * Used instead of Nest's `FileTypeValidator`, whose ESM-only `file-type`
 * dependency can't load under this project's Jest setup (it then rejects
 * every file). Needs the file in memory (`buffer`), so don't give the
 * interceptor disk storage.
 */
export class ImageSignatureValidator extends FileValidator {
  constructor() {
    super({});
  }

  isValid(file?: IFile | IFile[] | Record<string, IFile[]>): boolean {
    // Only a single uploaded file is valid here, not an array or a map.
    const buffer = (file as { buffer?: unknown } | undefined)?.buffer;
    return Buffer.isBuffer(buffer) && detectImageType(buffer) !== null;
  }

  buildErrorMessage(): string {
    return 'File must be a PNG, JPEG or WebP image';
  }
}
