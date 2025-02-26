import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('LogoutController', () => {
    let controller: AuthController;
    let logoutService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        logout: jest.fn(), // Mock function
                    },
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        logoutService = module.get<AuthService>(AuthService);
    });

    it('should call logout service and return success message', async () => {
        const expectedResponse = { message: 'Logout successful' };
        (logoutService.logout as jest.Mock).mockResolvedValue(expectedResponse);

        const result = await controller.logout();
        expect(result).toEqual(expectedResponse);
        expect(logoutService.logout).toHaveBeenCalled();
    });
});
