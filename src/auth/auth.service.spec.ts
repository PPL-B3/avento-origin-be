import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              update: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('blacklistToken', () => {
    it('should update lastLogout with the current timestamp', async () => {
      const userId = '123';
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({ id: userId } as any);

      await expect(authService.blacklistToken(userId)).resolves.toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { lastLogout: expect.any(Date) },
      });
    });

    it('should throw an error if updating lastLogout fails', async () => {
      const userId = '123';
      jest
        .spyOn(prismaService.user, 'update')
        .mockRejectedValueOnce(new Error('DB Error'));

      await expect(authService.blacklistToken(userId)).rejects.toThrow(
        'DB Error',
      );
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true if user is not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      const result = await authService.isTokenBlacklisted('token', '123');
      expect(result).toBe(true);
    });

    it('should return true if lastLogout is null', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce({ id: '123', lastLogout: null } as any);

      const result = await authService.isTokenBlacklisted('token', '123');
      expect(result).toBe(true);
    });

    it('should return true if token is invalid', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue(null);

      const result = await authService.isTokenBlacklisted(
        'invalidToken',
        '123',
      );
      expect(result).toBe(true);
    });

    it('should return false if token is still valid', async () => {
      const mockLastLogout = new Date(Date.now() - 10000);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        id: '123',
        lastLogout: mockLastLogout,
      } as any);
      jest.spyOn(jwt, 'decode').mockReturnValue({
        iat: Math.floor(Date.now() / 1000),
      } as jwt.JwtPayload);

      const result = await authService.isTokenBlacklisted('validToken', '123');
      expect(result).toBe(false);
    });

    it('should return true if token was issued before lastLogout', async () => {
      const mockLastLogout = new Date(Date.now() + 10000);
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        id: '123',
        lastLogout: mockLastLogout,
      } as any);
      jest.spyOn(jwt, 'decode').mockReturnValue({
        iat: Math.floor(Date.now() / 1000) - 20000,
      } as jwt.JwtPayload);

      const result = await authService.isTokenBlacklisted(
        'expiredToken',
        '123',
      );
      expect(result).toBe(true);
    });

    it('should return true if an error occurs during token decoding or user lookup', async () => {
      // Simulating an error during token decoding or database lookup
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockRejectedValueOnce(new Error('DB Error'));
      const result = await authService.isTokenBlacklisted('someToken', '123');
      expect(result).toBe(true);
    });
  });

  describe('logout', () => {
    it('should call blacklistToken with the correct userId', async () => {
      const userId = '123';
      jest.spyOn(authService, 'blacklistToken').mockResolvedValueOnce();

      await authService.logout(userId);

      expect(authService.blacklistToken).toHaveBeenCalledWith(userId);
    });
  });
});
