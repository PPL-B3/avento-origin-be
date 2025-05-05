import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { SentryExceptionCaptured } from "@sentry/nestjs";

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost): void {
    // Deteksi jika exception adalah instansi dari HttpException
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    // Menangkap semua jenis exception dan mengirimnya ke Sentry
    Sentry.captureException(exception); // kirim ke Sentry

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
