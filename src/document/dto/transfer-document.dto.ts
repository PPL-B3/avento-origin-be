import { IsEmail, IsNotEmpty } from "class-validator";

export class TransferDocumentDTO {
  @IsNotEmpty()
  documentId: string;

  @IsEmail()
  pendingOwner: string;
}
