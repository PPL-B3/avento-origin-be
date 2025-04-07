import { IsEmail, IsUUID } from "class-validator";

export class QRTransferDTO {
  @IsUUID()
  documentId: string;

  @IsEmail()
  email: string;
}
