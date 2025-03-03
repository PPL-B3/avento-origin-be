import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDto } from './dto';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(), // Mock register method
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  it('should call authService.register() with the correct data', async () => {
    const dto: AuthDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockResponse = { id: '123', email: dto.email, role: 'user' };

    jest.spyOn(authService, 'register').mockResolvedValue(mockResponse);

    const result = await authController.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
