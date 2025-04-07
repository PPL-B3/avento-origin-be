import * as AWS from "aws-sdk";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class S3StorageService {
  private readonly s3: AWS.S3;

  constructor(private readonly configService: ConfigService) {
    this.s3 = new AWS.S3({
      endpoint: configService.get<string>("DO_SPACES_ENDPOINT"),
      accessKeyId: configService.get<string>("DO_SPACES_KEY"),
      secretAccessKey: configService.get<string>("DO_SPACES_SECRET"),
      region: configService.get<string>("DO_SPACES_REGION"),
    });
  }

  async uploadPDF(
    buffer: Buffer,
    mimetype: string,
    bucketName: string,
    filename: string
  ): Promise<string> {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentType: mimetype,
    };

    const { Location } = await this.s3.upload(params).promise();
    return Location;
  }
}
