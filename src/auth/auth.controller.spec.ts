import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ForbiddenException } from '@nestjs/common';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn().mockResolvedValue({ message: 'Logout successful' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call logout service with userId and return success message', async () => {
    const userId = '123'; // userId as a string

    const logoutSpy = jest.spyOn(authService, 'logout');

    const result = await authController.logout(userId); // Pass the userId directly

    expect(result).toEqual({ message: 'Logout successful' });
    expect(logoutSpy).toHaveBeenCalledWith(userId); // Check if only userId is passed
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  /** ✅ POSITIVE CASE: Successful registration */
  it('should register a new user successfully', async () => {
    const dto: AuthDto = { email: 'test@example.com', password: 'password123' };
    const mockResponse = {
      id: '123',
      email: dto.email,
      role: 'user',
    };

    jest.spyOn(authService, 'register').mockResolvedValue(mockResponse);

    const result = await authController.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  /** ❌ NEGATIVE CASE: Email already exists (P2002 error) */
  it('should throw ForbiddenException if email is already registered', async () => {
    const dto: AuthDto = {
      email: 'duplicate@example.com',
      password: 'password123',
    };

    jest.spyOn(authService, 'register').mockRejectedValue(
      new PrismaClientKnownRequestError(
        'Unique constraint failed on the field: `email`',
        {
          code: 'P2002',
          clientVersion: '6.4.1',
        },
      ),
    );

    await expect(authController.register(dto)).rejects.toThrow(
      PrismaClientKnownRequestError,
    );
    await expect(authController.register(dto)).rejects.toThrow(
      'Unique constraint failed on the field: `email`',
    );

    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  /** ✅ POSITIVE CASE: Successful login */
  it('should return user details when login is successful', async () => {
    const dto: AuthDto = { email: 'test@example.com', password: 'password123' };
    const mockUser = {
      id: '123',
      email: dto.email,
      role: 'user',
      lastLogout: BigInt(Date.now()),
    };

    jest.spyOn(authService, 'login').mockResolvedValue(mockUser);

    const result = await authController.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockUser);
  });

  /** ❌ NEGATIVE CASE: Incorrect password */
  it('should throw ForbiddenException if password is incorrect', async () => {
    const dto: AuthDto = {
      email: 'test@example.com',
      password: 'wrongpassword',
    };

    jest
      .spyOn(authService, 'login')
      .mockRejectedValue(
        new ForbiddenException('Username or password is incorrect'),
      );

    await expect(authController.login(dto)).rejects.toThrow(ForbiddenException);
    await expect(authController.login(dto)).rejects.toThrow(
      'Username or password is incorrect',
    );

    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  /** ❌ NEGATIVE CASE: Non-existent user */
  it('should throw ForbiddenException if user does not exist', async () => {
    const dto: AuthDto = {
      email: 'notfound@example.com',
      password: 'password123',
    };

    jest
      .spyOn(authService, 'login')
      .mockRejectedValue(
        new ForbiddenException('Username or password is incorrect'),
      );

    await expect(authController.login(dto)).rejects.toThrow(ForbiddenException);
    await expect(authController.login(dto)).rejects.toThrow(
      'Username or password is incorrect',
    );

    expect(authService.login).toHaveBeenCalledWith(dto);
  });
});
