import * as AWS from "aws-sdk";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectRequest } from "aws-sdk/clients/s3";

@Injectable()
export class DocumentService {
  private readonly bucket: AWS.S3;

  constructor(private readonly configSerivce: ConfigService) {
    this.bucket = new AWS.S3({
      endpoint: configSerivce.get<string>("DO_SPACES_ENDPOINT"),
      accessKeyId: configSerivce.get<string>("DO_SPACES_KEY"),
      secretAccessKey: configSerivce.get<string>("DO_SPACES_SECRET"),
      region: configSerivce.get<string>("DO_SPACES_REGION"),
    });
  }

  async uploadToBucket(
    pdf: Express.Multer.File,
    filename: string
  ): Promise<string> {
    if (!this.configSerivce.get<string>("DO_SPACES_BUCKET")) {
      throw new Error("DO_SPACES_BUCKET environment variable is not defined.");
    }

    const params = {
      Bucket: this.configSerivce.get<string>("DO_SPACES_BUCKET"),
      Key: filename,
      Body: pdf.buffer,
      ContentType: pdf.mimetype,
    };

    const { Location } = await this.bucket
      .upload(params as PutObjectRequest)
      .promise();

    return Location;
  }

  async uploadDocument(pdf: Express.Multer.File, body: any) {
    const url = await this.uploadToBucket(pdf, body.ownerName);
    return { message: "Document uploaded successfully.", url };
  }
}
