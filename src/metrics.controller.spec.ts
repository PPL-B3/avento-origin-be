import { MetricsController } from "./metrics.controller";
import { Registry } from "prom-client";
import { Response } from "express";

describe("MetricsController", () => {
  let controller: MetricsController;
  let registry: Registry;
  let res: Partial<Response>;

  beforeEach(() => {
    // Create a dummy registry instance with a mocked metrics() method and contentType.
    registry = {
      metrics: jest.fn().mockResolvedValue("dummy metrics output"),
      contentType: "text/plain",
    } as any as Registry;

    // Create a dummy Express response object with spies on set and send.
    res = {
      set: jest.fn(),
      send: jest.fn(),
    };

    controller = new MetricsController(registry);
  });

  it("should call registry.metrics, set the response Content-Type and send the metrics", async () => {
    await controller.getMetrics(res as Response);

    // Assert that registry.metrics has been called to gather metrics.
    expect(registry.metrics).toHaveBeenCalled();

    // Assert that the response header is set properly.
    expect(res.set).toHaveBeenCalledWith("Content-Type", registry.contentType);

    // Assert that the metrics output is sent.
    expect(res.send).toHaveBeenCalledWith("dummy metrics output");
  });
});
