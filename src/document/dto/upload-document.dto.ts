import { IsNotEmpty } from "class-validator";

export class UploadDocumentDTO {
  @IsNotEmpty()
  documentName: string;

  @IsNotEmpty()
  ownerName: string;
}
