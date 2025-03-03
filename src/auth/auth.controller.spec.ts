import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            logout: jest
              .fn()
              .mockResolvedValue({ message: "Logout successful" }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it("should call logout service with userId and return success message", async () => {
    const userId = "123"; // userId as a string

    const logoutSpy = jest.spyOn(authService, "logout");

    const result = await controller.logout(userId); // Pass the userId directly

    expect(result).toEqual({ message: "Logout successful" });
    expect(logoutSpy).toHaveBeenCalledWith(userId); // Check if only userId is passed
  });
});
