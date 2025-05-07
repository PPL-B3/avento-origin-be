import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthDto } from "./dto";
import { ApiBody, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { MetricService } from "../pushBack/metric.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly metricService: MetricService,
  ) {}

  @Post("logout")
  @ApiOperation({ summary: "Logout a user" })
  @ApiBody({
    description: "User ID required to logout",
    schema: {
      type: "object",
      properties: {
        userId: { type: "string", example: "123" },
      },
      required: ["userId"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Successfully logged out",
    schema: { example: { success: true, message: "Berhasil logout" } },
  })
  @ApiResponse({ status: 400, description: "User ID must be provided" })
  async logout(@Body("userId") userId: string) {
    const result = await this.authService.logout(userId);

    if (result.success) {
      this.metricService.updateLogoutMetric("success", "user");
      await this.metricService.pushMetricsToGateway(
        "auth_controller",
        `logout_${userId}`,
      );
    }

    return result;
  }

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User successfully registered",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "abc123" },
        email: { type: "string", example: "user@example.com" },
        role: { type: "string", example: "user" },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Email has already been registered",
  })
  async register(@Body() dto: AuthDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login a user" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged in",
    schema: {
      type: "object",
      properties: {
        access_token: { type: "string", example: "jwt-token-string" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "abc123" },
            email: { type: "string", example: "user@example.com" },
            role: { type: "string", example: "user" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Username or password is incorrect",
  })
  async login(@Body() dto: AuthDto) {
    const startTime = Date.now();
    const method = "email_password";

    const result = await this.authService.login(dto);

    const duration = (Date.now() - startTime) / 1000;

    this.metricService.updateLoginMetric(
      method,
      "success",
      result.user.role,
      duration,
    );

    await this.metricService.pushMetricsToGateway(
      "auth_controller",
      `login_${result.user.id}`,
    );

    return result;
  }
}
