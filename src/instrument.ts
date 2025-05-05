import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: "https://fc0974cfc7efd0153f51008ff6ea46da@o4509272020680704.ingest.de.sentry.io/4509272031101008",

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
