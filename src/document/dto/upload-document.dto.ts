import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UploadDocumentDTO {
  @ApiProperty()
  @IsNotEmpty()
  documentName: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  ownerName: string;
}
