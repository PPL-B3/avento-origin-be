import { Injectable, Logger } from "@nestjs/common";
import * as client from "prom-client";
import { Pushgateway } from "prom-client";

@Injectable()
export class MetricService {
  private readonly logger = new Logger(MetricService.name);

  private readonly userLoginCounter: client.Counter;
  private readonly userLogoutCounter: client.Counter;
  private readonly userLoginDurationHistogram: client.Histogram;
  private readonly userLoginFailureCounter: client.Counter;

  private readonly documentUploadCounter: client.Counter;
  private readonly documentUploadDurationHistogram: client.Histogram;
  private readonly documentUploadSizeGauge: client.Gauge;
  private readonly documentUploadFailureCounter: client.Counter;

  private readonly logSearchCounter: client.Counter;
  private readonly logSearchDurationGauge: client.Gauge;
  private readonly logSearchFailureCounter: client.Counter;

  private readonly documentTransferCounter: client.Counter;
  private readonly documentTransferDurationGauge: client.Gauge;
  private readonly documentTransferFailureCounter: client.Counter;

  constructor() {
    try {
      // Initialize counters, histograms, and gauges for each metric
      this.userLoginCounter = new client.Counter({
        name: "user_login_total",
        help: "Total user login",
        labelNames: ["method", "status", "role"],
      });

      this.userLogoutCounter = new client.Counter({
        name: "user_logout_total",
        help: "Total user logout",
        labelNames: ["status", "role"],
      });

      this.userLoginDurationHistogram = new client.Histogram({
        name: "user_login_duration_seconds",
        help: "Durasi proses login",
        buckets: [0.1, 0.5, 1, 2, 5, 10],
      });

      this.userLoginFailureCounter = new client.Counter({
        name: "user_login_failure_total",
        help: "Jumlah login gagal",
        labelNames: ["method", "role"],
      });

      this.documentUploadCounter = new client.Counter({
        name: "document_upload_total",
        help: "Total dokumen yang diupload",
      });

      this.documentUploadDurationHistogram = new client.Histogram({
        name: "document_upload_duration_seconds",
        help: "Durasi upload dokumen",
        buckets: [0.5, 1, 2, 5, 10],
      });

      this.documentUploadSizeGauge = new client.Gauge({
        name: "document_upload_size_bytes",
        help: "Ukuran dokumen yang diupload",
      });

      this.documentUploadFailureCounter = new client.Counter({
        name: "document_upload_failure_total",
        help: "Upload yang gagal",
      });

      this.logSearchCounter = new client.Counter({
        name: "log_search_total",
        help: "Total pencarian log",
      });

      this.logSearchDurationGauge = new client.Gauge({
        name: "log_search_duration_seconds",
        help: "Waktu respon pencarian",
      });

      this.logSearchFailureCounter = new client.Counter({
        name: "log_search_failure_total",
        help: "Pencarian log gagal",
      });

      this.documentTransferCounter = new client.Counter({
        name: "document_transfer_total",
        help: "Total dokumen ditransfer",
      });

      this.documentTransferDurationGauge = new client.Gauge({
        name: "document_transfer_duration_seconds",
        help: "Lama waktu transfer",
      });

      this.documentTransferFailureCounter = new client.Counter({
        name: "document_transfer_failure_total",
        help: "Jumlah transfer gagal",
      });
    } catch (error) {
      this.logger.error(`Failed to initialize metrics: ${error.message}`);
      // Continue with service initialized but metrics disabled
    }
  }

  // Push metrics to Prometheus Push Gateway using Pushgateway
  async pushMetricsToGateway(jobName: string, instanceName: string) {
    try {
      const gateway = new Pushgateway("https://pushgateaway.up.railway.app/");

      // Perbaikan: gunakan parameter yang benar sesuai dengan Pushgateway API
      await gateway.push({
        jobName: jobName,
        groupings: { instance: instanceName },
      });

      this.logger.log("Metrics pushed to Pushgateway");
    } catch (error) {
      this.logger.error(
        `Failed to push metrics to Prometheus: ${error.message}`,
      );
      // Failure to push metrics should not affect the application
    }
  }

  // Safe method to execute metric updates with error handling
  private safeMetricUpdate(metricFn: Function, errorMessage: string) {
    try {
      metricFn();
    } catch (error) {
      this.logger.error(`${errorMessage}: ${error.message}`);
      // Failure to update metrics should not affect application flow
    }
  }

  // Method to update login metric
  updateLoginMetric(
    method: string,
    status: string,
    role: string,
    duration: number,
  ) {
    this.safeMetricUpdate(() => {
      this.userLoginCounter.inc({ method, status, role });
      this.userLoginDurationHistogram.observe(duration);
    }, "Failed to update login metrics");
  }

  updateLogoutMetric(status: string, role: string) {
    this.safeMetricUpdate(() => {
      this.userLogoutCounter.inc({ status, role });
    }, "Failed to update logout metrics");
  }

  updateLoginFailureMetric(method: string, role: string) {
    this.safeMetricUpdate(() => {
      this.userLoginFailureCounter.inc({ method, role });
    }, "Failed to update login failure metrics");
  }

  updateDocumentUploadMetric() {
    this.safeMetricUpdate(() => {
      this.documentUploadCounter.inc();
    }, "Failed to update document upload metrics");
  }

  updateDocumentUploadDurationMetric(duration: number) {
    this.safeMetricUpdate(() => {
      this.documentUploadDurationHistogram.observe(duration);
    }, "Failed to update document upload duration metrics");
  }

  updateDocumentUploadSizeMetric(size: number) {
    this.safeMetricUpdate(() => {
      this.documentUploadSizeGauge.set(size);
    }, "Failed to update document upload size metrics");
  }

  updateDocumentUploadFailureMetric() {
    this.safeMetricUpdate(() => {
      this.documentUploadFailureCounter.inc();
    }, "Failed to update document upload failure metrics");
  }

  updateLogSearchMetric() {
    this.safeMetricUpdate(() => {
      this.logSearchCounter.inc();
    }, "Failed to update log search metrics");
  }

  updateLogSearchDurationMetric(duration: number) {
    this.safeMetricUpdate(() => {
      this.logSearchDurationGauge.set(duration);
    }, "Failed to update log search duration metrics");
  }

  updateLogSearchFailureMetric() {
    this.safeMetricUpdate(() => {
      this.logSearchFailureCounter.inc();
    }, "Failed to update log search failure metrics");
  }

  updateDocumentTransferMetric() {
    this.safeMetricUpdate(() => {
      this.documentTransferCounter.inc();
    }, "Failed to update document transfer metrics");
  }

  updateDocumentTransferDurationMetric(duration: number) {
    this.safeMetricUpdate(() => {
      this.documentTransferDurationGauge.set(duration);
    }, "Failed to update document transfer duration metrics");
  }

  updateDocumentTransferFailureMetric() {
    this.safeMetricUpdate(() => {
      this.documentTransferFailureCounter.inc();
    }, "Failed to update document transfer failure metrics");
  }
}
