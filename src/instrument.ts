import * as Sentry from "@sentry/nestjs";
import { ConfigService } from "@nestjs/config";

// We'll need to initialize Sentry after the app module is created
// so we can access the ConfigService
export function initSentry(configService: ConfigService) {
  Sentry.init({
    dsn: configService.get<string>("SENTRY_DSN"),

    // Keep the original settings
    sendDefaultPii: true,
  });
}
