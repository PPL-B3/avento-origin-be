import { Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('logout')
export class AuthController {
    constructor(private readonly logoutService: AuthService) {}

    @Post()
    logout() {
        return this.logoutService.logout();
    }
}
