import { BadRequestException, Injectable } from "@nestjs/common";
import { PasswordPolicy } from "../interfaces/password-policy.interface";

@Injectable()
export class DefaultPasswordPolicy implements PasswordPolicy {
  validate(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must include at least one lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must include at least one uppercase letter");
    }
    if (!/\d/.test(password)) {
      errors.push("Password must include at least one number");
    }
    if (!/[\W_]/.test(password)) {
      errors.push("Password must include at least one special character");
    }

    if (errors.length > 0) {
      throw new BadRequestException({ errors });
    }
  }
}
