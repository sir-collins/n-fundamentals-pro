import { describe, expect, it } from '@jest/globals';
import {
  detectImageType,
  ImageSignatureValidator,
} from './image-signature.validator';

// Just the signatures: detection only reads the first bytes.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8 '),
]);
const text = Buffer.from('hello, I am definitely a PNG');

describe('detectImageType', () => {
  it('recognises PNG, JPEG and WebP by their bytes', () => {
    expect(detectImageType(png)).toEqual({ ext: 'png', mime: 'image/png' });
    expect(detectImageType(jpeg)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(detectImageType(webp)).toEqual({ ext: 'webp', mime: 'image/webp' });
  });

  it('rejects anything else, including too-short and empty buffers', () => {
    expect(detectImageType(text)).toBeNull();
    expect(detectImageType(Buffer.from('RIFF....WAVE'))).toBeNull();
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('ImageSignatureValidator', () => {
  const validator = new ImageSignatureValidator();

  it('trusts the bytes, not the claimed mimetype', () => {
    expect(
      validator.isValid({ mimetype: 'text/plain', size: 9, buffer: png }),
    ).toBe(true);
    expect(
      validator.isValid({ mimetype: 'image/png', size: 28, buffer: text }),
    ).toBe(false);
  });

  it('rejects a missing file, a file without a buffer, and arrays', () => {
    expect(validator.isValid(undefined)).toBe(false);
    expect(validator.isValid({ mimetype: 'image/png', size: 9 })).toBe(false);
    expect(
      validator.isValid([{ mimetype: 'image/png', size: 9, buffer: png }]),
    ).toBe(false);
  });
});
