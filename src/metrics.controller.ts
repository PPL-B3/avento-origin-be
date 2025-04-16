import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { Registry } from "prom-client";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly registry: Registry) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.registry.metrics();
    res.set("Content-Type", this.registry.contentType);
    res.send(metrics);
  }
}
