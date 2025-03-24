import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('logout')
  @ApiOperation({ summary: 'Logout a user' })
  @ApiBody({
    description: 'User ID required to logout',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: '123' },
      },
      required: ['userId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Successfully logged out', schema: { example: { success: true, message: 'Berhasil logout' } } })
  @ApiResponse({ status: 400, description: 'User ID must be provided' })
  logout(@Body('userId') userId: string) {
    // userId is a string
    return this.authService.logout(userId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'abc123' },
        email: { type: 'string', example: 'user@example.com' },
        role: { type: 'string', example: 'user' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Email has already been registered' })
  register(@Body() dto: AuthDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'jwt-token-string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'abc123' },
            email: { type: 'string', example: 'user@example.com' },
            role: { type: 'string', example: 'user' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Username or password is incorrect' })
  login(@Body() dto: AuthDto) {
    return this.authService.login(dto);
  }
}
