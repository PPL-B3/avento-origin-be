import { IsNotEmpty, Matches } from "class-validator";

export class ClaimDocumentDTO {
  @IsNotEmpty()
  documentId: string;

  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: "OTP must be a 6-digit number." })
  otp: string;
}
