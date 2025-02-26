import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';

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
              create: jest.fn(), // Mock user.create()
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
      select: {
        id: true,
        email: true,
      },
    });

    expect(result).toEqual(mockUser);
  });

  it('should throw an error if Prisma fails', async () => {
    const dto: AuthDto = {
      email: 'fail@example.com',
      password: 'password123',
    };

    jest.spyOn(argon, 'hash').mockResolvedValue('hashedpassword');
    jest
      .spyOn(prismaService.user, 'create')
      .mockRejectedValue(new Error('Prisma error'));

    await expect(authService.register(dto)).rejects.toThrow('Prisma error');

    expect(argon.hash).toHaveBeenCalledWith(dto.password);
    expect(prismaService.user.create).toHaveBeenCalled();
  });
});
