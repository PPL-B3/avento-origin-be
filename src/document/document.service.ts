import * as AWS from "aws-sdk";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentService {
  private bucket: AWS.S3;

  constructor() {
    this.bucket = new AWS.S3({
      endpoint: process.env.DO_SPACES_ENDPOINT,
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      region: process.env.DO_SPACES_REGION,
    });
  }

  async uploadToBucket(
    pdf: Express.Multer.File,
    filename: string
  ): Promise<string> {
    if (!process.env.DO_SPACES_BUCKET) {
      throw new Error("DO_SPACES_BUCKET environment variable is not defined.");
    }

    const params = {
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: filename,
      Body: pdf.buffer,
      ContentType: pdf.mimetype,
    };

    const { Location } = await this.bucket.upload(params).promise();

    return Location;
  }

  async uploadDocument(pdf: Express.Multer.File, body: any) {
    const url = await this.uploadToBucket(pdf, body.ownerName);
    return { message: "Document uploaded successfully.", url };
  }
}
