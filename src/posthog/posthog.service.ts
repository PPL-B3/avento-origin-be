import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class PostHogService {
  private readonly apiUrl = "https://app.posthog.com/capture";

  constructor(private readonly configService: ConfigService) {}

  async captureEvent(
    distinctId: string,
    event: string,
    properties?: Record<string, any>,
  ) {
    try {
      await axios.post(this.apiUrl, {
        api_key: this.configService.get<string>("POSTHOG_APIKEY"),
        event,
        properties,
        distinct_id: distinctId,
      });
    } catch (err) {
      console.error("PostHog event failed:", err.message);
    }
  }
}
