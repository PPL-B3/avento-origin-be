import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { ForbiddenException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
              create: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should register a new user successfully', async () => {
    const dto: AuthDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '123',
      email: 'test@test.com',
      password: 'hashedpassword',
      role: 'user',
    };

    jest.spyOn(argon, 'hash').mockResolvedValue('hashedpassword');
    jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser);

    const result = await authService.register(dto);

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalledWith({
      data: {
        email: dto.email,
        password: 'hashedpassword',
        role: 'user',
      },
    });

    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  it('should throw ForbiddenException if email is already registered', async () => {
    const dto: AuthDto = {
      email: 'duplicate@example.com',
      password: 'password123',
    };

    jest.spyOn(argon, 'hash').mockResolvedValue('hashedpassword');
    jest.spyOn(prismaService.user, 'create').mockRejectedValue(
      new PrismaClientKnownRequestError('', {
        code: 'P2002',
        clientVersion: '6.4.1',
      }),
    );

    await expect(authService.register(dto)).rejects.toThrow(ForbiddenException);
    await expect(authService.register(dto)).rejects.toThrow(
      'Email has already been registered',
    );

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalled();
  });

  it('should throw a generic error if Prisma fails unexpectedly', async () => {
    const dto: AuthDto = {
      email: 'fail@example.com',
      password: 'password123',
    };

    jest.spyOn(argon, 'hash').mockResolvedValue('hashedpassword');
    jest
      .spyOn(prismaService.user, 'create')
      .mockRejectedValue(new Error('Unexpected database error'));

    await expect(authService.register(dto)).rejects.toThrow(Error);
    await expect(authService.register(dto)).rejects.toThrow(
      'Unexpected database error',
    );

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalled();
  });

  it('should return user details when login is successful', async () => {
    const dto: AuthDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '123',
      email: dto.email,
      password: 'hashedpassword',
      role: 'user',
    };

    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);
    jest.spyOn(argon, 'verify').mockResolvedValue(true);

    const result = await authService.login(dto);

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
    expect(argon.verify).toHaveBeenCalledWith(mockUser.password, dto.password);
    expect(result).toEqual({ id: '123', email: dto.email });
  });

  it('should throw ForbiddenException if user is not found', async () => {
    const dto: AuthDto = {
      email: 'nonexistent@example.com',
      password: 'password123',
    };

    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

    await expect(authService.login(dto)).rejects.toThrow(ForbiddenException);
    await expect(authService.login(dto)).rejects.toThrow(
      'Username or password is incorrect',
    );

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
  });

  it('should throw ForbiddenException if password is incorrect', async () => {
    const dto: AuthDto = {
      email: 'test@example.com',
      password: 'wrongpassword',
    };

    const mockUser = {
      id: '123',
      email: dto.email,
      password: 'hashedpassword',
      role: 'user',
    };

    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);
    jest.spyOn(argon, 'verify').mockResolvedValue(false);

    await expect(authService.login(dto)).rejects.toThrow(ForbiddenException);
    await expect(authService.login(dto)).rejects.toThrow(
      'Username or password is incorrect',
    );

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
    expect(argon.verify).toHaveBeenCalledWith(mockUser.password, dto.password);
  });

  it('should throw an error if Prisma throws an exception', async () => {
    const dto: AuthDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    jest
      .spyOn(prismaService.user, 'findUnique')
      .mockRejectedValue(new Error('Database error'));

    await expect(authService.login(dto)).rejects.toThrow(Error);
    await expect(authService.login(dto)).rejects.toThrow('Database error');

    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: dto.email },
    });
  });
});
