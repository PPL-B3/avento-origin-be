import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class PostHogService {
  private readonly apiKey = "phc_y5HJD0i3FYXaowP2gRA8RlRSWS7f6THPk6pG8oIV39J";
  private readonly apiUrl = "https://app.posthog.com/capture";

  async captureEvent(
    distinctId: string,
    event: string,
    properties?: Record<string, any>
  ) {
    try {
      await axios.post(this.apiUrl, {
        api_key: this.apiKey,
        event,
        properties,
        distinct_id: distinctId,
      });
    } catch (err) {
      console.error("PostHog event failed:", err.message);
    }
  }
}
