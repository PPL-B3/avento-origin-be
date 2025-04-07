import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class AuthDto {
  @ApiProperty({
    example: "user@example.com",
    description: "User email address",
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: "Password123!", description: "User password" })
  @IsNotEmpty()
  @IsString()
  password: string;
}
