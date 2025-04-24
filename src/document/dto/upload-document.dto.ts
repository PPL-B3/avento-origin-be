import { IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UploadDocumentDTO {
  @ApiProperty()
  @IsNotEmpty()
  documentName: string;
}
