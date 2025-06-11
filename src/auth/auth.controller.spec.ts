import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthDto } from "./dto";
import { MetricService } from "../pushBack/metric.service";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";

describe("AuthController", () => {
  let authController: AuthController;
  let authService: AuthService;
  let metricService: MetricService;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
    };

    const mockMetricService = {
      updateLogoutMetric: jest.fn(),
      updateLoginMetric: jest.fn(),
      updateLoginFailureMetric: jest.fn(),
      pushMetricsToGateway: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: MetricService, useValue: mockMetricService },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    metricService = module.get<MetricService>(MetricService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(authController).toBeDefined();
  });

  describe("logout", () => {
    it("should call logout service and update metrics when logout is successful", async () => {
      const userId = "123";
      const mockLogoutResponse = {
        success: true,
        message: "Logout successful",
      };

      jest.spyOn(authService, "logout").mockResolvedValue(mockLogoutResponse);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockResolvedValue(undefined);

      const result = await authController.logout(userId);

      expect(authService.logout).toHaveBeenCalledWith(userId);
      expect(metricService.updateLogoutMetric).toHaveBeenCalledWith(
        "success",
        "user",
      );
      expect(metricService.pushMetricsToGateway).toHaveBeenCalledWith(
        "auth_controller",
        `logout_${userId}`,
      );
      expect(result).toEqual(mockLogoutResponse);
    });

    it("should call logout service but not update metrics when logout fails", async () => {
      const userId = "123";
      const mockLogoutResponse = {
        success: false,
        message: "Logout failed",
      };

      jest.spyOn(authService, "logout").mockResolvedValue(mockLogoutResponse);

      const result = await authController.logout(userId);

      expect(authService.logout).toHaveBeenCalledWith(userId);
      expect(metricService.updateLogoutMetric).not.toHaveBeenCalled();
      expect(metricService.pushMetricsToGateway).not.toHaveBeenCalled();
      expect(result).toEqual(mockLogoutResponse);
    });

    it("should handle logout service errors gracefully", async () => {
      const userId = "123";
      const error = new Error("Logout service error");

      jest.spyOn(authService, "logout").mockRejectedValue(error);

      await expect(authController.logout(userId)).rejects.toThrow(error);
      expect(authService.logout).toHaveBeenCalledWith(userId);
      expect(metricService.updateLogoutMetric).not.toHaveBeenCalled();
      expect(metricService.pushMetricsToGateway).not.toHaveBeenCalled();
    });

    it("should handle metrics push gateway errors gracefully", async () => {
      const userId = "123";
      const mockLogoutResponse = {
        success: true,
        message: "Logout successful",
      };

      jest.spyOn(authService, "logout").mockResolvedValue(mockLogoutResponse);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockRejectedValue(new Error("Push gateway error"));

      // Should not throw error even if push gateway fails
      const result = await authController.logout(userId);

      expect(authService.logout).toHaveBeenCalledWith(userId);
      expect(metricService.updateLogoutMetric).toHaveBeenCalledWith(
        "success",
        "user",
      );
      expect(metricService.pushMetricsToGateway).toHaveBeenCalledWith(
        "auth_controller",
        `logout_${userId}`,
      );
      expect(result).toEqual(mockLogoutResponse);
    });
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const mockResponse = {
        id: "123",
        email: dto.email,
        role: Role.USER,
      };

      jest.spyOn(authService, "register").mockResolvedValue(mockResponse);

      const result = await authController.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });

    it("should throw PrismaClientKnownRequestError if email is already registered", async () => {
      const dto: AuthDto = {
        email: "duplicate@example.com",
        password: "password123",
      };
      const error = new PrismaClientKnownRequestError(
        "Unique constraint failed on the field: `email`",
        {
          code: "P2002",
          clientVersion: "6.4.1",
        },
      );

      jest.spyOn(authService, "register").mockRejectedValue(error);

      await expect(authController.register(dto)).rejects.toThrow(
        PrismaClientKnownRequestError,
      );
      await expect(authController.register(dto)).rejects.toThrow(
        "Unique constraint failed on the field: `email`",
      );

      expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it("should handle any other registration errors", async () => {
      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const error = new Error("Unexpected registration error");

      jest.spyOn(authService, "register").mockRejectedValue(error);

      await expect(authController.register(dto)).rejects.toThrow(error);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe("login", () => {
    beforeEach(() => {
      // Mock Date.now() to control timing for metric duration
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(1000) // startTime
        .mockReturnValueOnce(2500); // endTime (duration = 1.5 seconds)
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should return user details and update metrics when login is successful", async () => {
      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const mockUser = {
        access_token: "mock-jwt-token",
        user: {
          id: "123",
          email: dto.email,
          role: Role.USER,
        },
      };

      jest.spyOn(authService, "login").mockResolvedValue(mockUser);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockResolvedValue(undefined);

      const result = await authController.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(metricService.updateLoginMetric).toHaveBeenCalledWith(
        "email_password",
        "success",
        Role.USER,
        1.5, // duration in seconds
      );
      expect(metricService.pushMetricsToGateway).toHaveBeenCalledWith(
        "auth_controller",
        `login_${mockUser.user.id}`,
      );
      expect(result).toEqual(mockUser);
    });

    it("should return user details with ADMIN role and update metrics correctly", async () => {
      const dto: AuthDto = {
        email: "admin@example.com",
        password: "password123",
      };
      const mockUser = {
        access_token: "mock-jwt-token-admin",
        user: {
          id: "456",
          email: dto.email,
          role: Role.ADMIN,
        },
      };

      jest.spyOn(authService, "login").mockResolvedValue(mockUser);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockResolvedValue(undefined);

      const result = await authController.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(metricService.updateLoginMetric).toHaveBeenCalledWith(
        "email_password",
        "success",
        Role.ADMIN,
        1.5, // duration in seconds
      );
      expect(metricService.pushMetricsToGateway).toHaveBeenCalledWith(
        "auth_controller",
        `login_${mockUser.user.id}`,
      );
      expect(result).toEqual(mockUser);
    });

    it("should throw ForbiddenException if password is incorrect", async () => {
      const dto: AuthDto = {
        email: "test@example.com",
        password: "wrongpassword",
      };
      const error = new ForbiddenException("Username or password is incorrect");

      jest.spyOn(authService, "login").mockRejectedValue(error);

      await expect(authController.login(dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(authController.login(dto)).rejects.toThrow(
        "Username or password is incorrect",
      );

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(metricService.updateLoginMetric).not.toHaveBeenCalled();
      expect(metricService.pushMetricsToGateway).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException if user does not exist", async () => {
      const dto: AuthDto = {
        email: "notfound@example.com",
        password: "password123",
      };
      const error = new ForbiddenException("Username or password is incorrect");

      jest.spyOn(authService, "login").mockRejectedValue(error);

      await expect(authController.login(dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(authController.login(dto)).rejects.toThrow(
        "Username or password is incorrect",
      );

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(metricService.updateLoginMetric).not.toHaveBeenCalled();
      expect(metricService.pushMetricsToGateway).not.toHaveBeenCalled();
    });

    it("should handle any other login errors without updating metrics", async () => {
      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const error = new Error("Unexpected login error");

      jest.spyOn(authService, "login").mockRejectedValue(error);

      await expect(authController.login(dto)).rejects.toThrow(error);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(metricService.updateLoginMetric).not.toHaveBeenCalled();
      expect(metricService.pushMetricsToGateway).not.toHaveBeenCalled();
    });

    it("should handle metrics push gateway errors gracefully", async () => {
      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const mockUser = {
        access_token: "mock-jwt-token",
        user: {
          id: "123",
          email: dto.email,
          role: Role.USER,
        },
      };

      jest.spyOn(authService, "login").mockResolvedValue(mockUser);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockRejectedValue(new Error("Push gateway error"));

      // Should not throw error even if push gateway fails
      const result = await authController.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(metricService.updateLoginMetric).toHaveBeenCalledWith(
        "email_password",
        "success",
        Role.USER,
        1.5,
      );
      expect(metricService.pushMetricsToGateway).toHaveBeenCalledWith(
        "auth_controller",
        `login_${mockUser.user.id}`,
      );
      expect(result).toEqual(mockUser);
    });

    it("should handle different time durations correctly", async () => {
      // Reset the Date.now() mock for different timing
      jest.restoreAllMocks();
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(1000) // startTime
        .mockReturnValueOnce(3000); // endTime (duration = 2 seconds)

      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const mockUser = {
        access_token: "mock-jwt-token",
        user: {
          id: "123",
          email: dto.email,
          role: Role.USER,
        },
      };

      jest.spyOn(authService, "login").mockResolvedValue(mockUser);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockResolvedValue(undefined);

      await authController.login(dto);

      expect(metricService.updateLoginMetric).toHaveBeenCalledWith(
        "email_password",
        "success",
        Role.USER,
        2.0, // duration in seconds
      );
    });

    // Additional test case: Test for successful login with metrics updating but gateway push fails gracefully
    it("should update metrics successfully when login succeeds even if gateway push fails", async () => {
      // Mock console.error to verify it gets called
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const dto: AuthDto = {
        email: "test@example.com",
        password: "password123",
      };
      const mockUser = {
        access_token: "mock-jwt-token",
        user: {
          id: "123",
          email: dto.email,
          role: Role.USER,
        },
      };

      jest.spyOn(authService, "login").mockResolvedValue(mockUser);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockRejectedValue(new Error("Push gateway error"));

      const result = await authController.login(dto);

      expect(result).toEqual(mockUser);
      expect(metricService.updateLoginMetric).toHaveBeenCalledWith(
        "email_password",
        "success",
        Role.USER,
        1.5,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to push metrics to gateway:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Edge cases and special scenarios", () => {
    it("should handle logout with push gateway error gracefully and log error", async () => {
      // Mock console.error to verify it gets called
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const userId = "123";
      const mockLogoutResponse = {
        success: true,
        message: "Logout successful",
      };

      jest.spyOn(authService, "logout").mockResolvedValue(mockLogoutResponse);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockRejectedValue(new Error("Push gateway error"));

      const result = await authController.logout(userId);

      expect(result).toEqual(mockLogoutResponse);
      expect(metricService.updateLogoutMetric).toHaveBeenCalledWith(
        "success",
        "user",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to push metrics to gateway:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle successful logout with updateLogoutMetric but not call pushMetricsToGateway on failure", async () => {
      const userId = "special-id";
      const mockLogoutResponse = {
        success: true,
        message: "Logout successful",
      };

      jest.spyOn(authService, "logout").mockResolvedValue(mockLogoutResponse);
      jest
        .spyOn(metricService, "pushMetricsToGateway")
        .mockResolvedValue(undefined);

      const result = await authController.logout(userId);

      expect(result).toEqual(mockLogoutResponse);
      expect(metricService.updateLogoutMetric).toHaveBeenCalledWith(
        "success",
        "user",
      );
      expect(metricService.pushMetricsToGateway).toHaveBeenCalledWith(
        "auth_controller",
        `logout_${userId}`,
      );
    });
  });
});
