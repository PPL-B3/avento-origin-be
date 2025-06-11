import { Module, Global } from "@nestjs/common";
import { MetricService } from "./metric.service";

@Global()
@Module({
  providers: [MetricService],
  exports: [MetricService],
})
export class MetricsModule {}
