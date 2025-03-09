import { Module } from "@nestjs/common";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";

@Module({
  controllers: [DocumentController],
  providers: [DocumentService],
})
export class DocumentModule {}
