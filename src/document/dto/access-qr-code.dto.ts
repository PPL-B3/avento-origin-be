import { IsNotEmpty, Matches } from "class-validator";

export class AccessQrCodeDTO {
  @IsNotEmpty()
  qrId: string;

  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: "OTP must be a 6-digit number." })
  otp: string;
}
