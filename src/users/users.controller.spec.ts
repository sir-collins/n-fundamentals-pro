import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AvatarStorageService } from './avatar-storage.service';
import { User } from './entities/user.entity';

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);
// The client claims PNG; the bytes are JPEG. The stored extension must
// follow the bytes.
const upload = {
  buffer: jpegBytes,
  mimetype: 'image/png',
  originalname: '../../evil.png',
} as Express.Multer.File;

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: DeepMocked<UsersService>;
  let storage: DeepMocked<AvatarStorageService>;

  beforeEach(() => {
    usersService = createMock<UsersService>();
    storage = createMock<AvatarStorageService>();
    storage.save.mockResolvedValue('1-new.jpg');
    storage.remove.mockResolvedValue(undefined);
    controller = new UsersController(usersService, storage);
  });

  describe('uploadAvatar', () => {
    it('stores under the detected extension and deletes the old file', async () => {
      usersService.setAvatarPath.mockResolvedValue({ previous: '1-old.png' });

      expect(await controller.uploadAvatar(1, upload)).toEqual({
        avatarUrl: '/users/1/avatar',
      });
      expect(storage.save).toHaveBeenCalledWith(1, jpegBytes, 'jpg');
      expect(usersService.setAvatarPath).toHaveBeenCalledWith(1, '1-new.jpg');
      expect(storage.remove).toHaveBeenCalledWith('1-old.png');
    });

    it('deletes nothing on a first upload', async () => {
      usersService.setAvatarPath.mockResolvedValue({ previous: null });

      await controller.uploadAvatar(1, upload);

      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('removes the new file and 401s if the user no longer exists', async () => {
      usersService.setAvatarPath.mockResolvedValue(null);

      await expect(controller.uploadAvatar(1, upload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(storage.remove).toHaveBeenCalledWith('1-new.jpg');
    });
  });

  describe('getAvatar', () => {
    it('404s for a user without an avatar', async () => {
      usersService.findById.mockResolvedValue({
        id: 1,
        avatarPath: null,
      } as User);

      await expect(controller.getAvatar(1)).rejects.toThrow(NotFoundException);
    });

    it('404s when the stored file is missing from disk', async () => {
      usersService.findById.mockResolvedValue({
        id: 1,
        avatarPath: '1-gone.png',
      } as User);
      storage.pathFor.mockReturnValue('/nonexistent/1-gone.png');

      await expect(controller.getAvatar(1)).rejects.toThrow(NotFoundException);
    });
  });
});
