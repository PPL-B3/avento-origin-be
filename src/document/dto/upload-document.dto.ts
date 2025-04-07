import { IsEmail, IsNotEmpty } from "class-validator";

export class UploadDocumentDTO {
  @IsNotEmpty()
  documentName: string;

  @IsEmail()
  ownerName: string;
}
