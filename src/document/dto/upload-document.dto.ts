import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class UploadDocumentDTO {
  @ApiProperty()
  @IsNotEmpty()
  documentName: string;

  @ApiProperty()
  @IsNotEmpty()
  ownerName: string;
}
