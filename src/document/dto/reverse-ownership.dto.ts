import { integer } from "aws-sdk/clients/cloudfront";
import { IsNotEmpty, IsNumber } from "class-validator";

export class ReverseOwnershipDTO {
  @IsNotEmpty()
  documentId: string;

  @IsNotEmpty()
  @IsNumber()
  index: integer;
}
