import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { HighlightInterceptor, H } from "@highlight-run/nest";

const env = {
  projectID: "ng2z350g",
  serviceName: "my-nestjs-app",
  serviceVersion: "git-sha",
  environment: "development",
  debug: false,
};

async function bootstrap() {
  H.init(env);

  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new HighlightInterceptor(env));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in DTO.
      forbidNonWhitelisted: true, // throws error if extra fields are sent.
      transform: true, // auto-transform payloads to DTO classes.
    })
  );
  app.enableCors();

  const configService = app.get(ConfigService);

  const config = new DocumentBuilder()
    .setTitle("Avento Origin")
    .setDescription("Avento Origin API Documentation")
    .setVersion("1.0")
    .build();

  const documentFactory = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(
    configService.get<string>("API_ENDPOINT", "api-default"),
    app,
    documentFactory
  );

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
