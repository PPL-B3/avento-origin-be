import axios from "axios";
import { PostHogService } from "./posthog.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("PostHogService", () => {
  let service: PostHogService;
  const apiUrl = "https://app.posthog.com/capture";
  const apiKey = "phc_y5HJD0i3FYXaowP2gRA8RlRSWS7f6THPk6pG8oIV39J";

  beforeEach(() => {
    service = new PostHogService();
    jest.clearAllMocks();
  });

  it("should call axios.post with correct parameters", async () => {
    // Arrange: simulate axios.post resolving.
    mockedAxios.post.mockResolvedValue({ data: "ok" });
    const distinctId = "user123";
    const event = "test_event";
    const properties = { foo: "bar" };

    // Act: call captureEvent.
    await service.captureEvent(distinctId, event, properties);

    // Assert: axios.post should be called once with expected URL & payload.
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(apiUrl, {
      api_key: apiKey,
      event,
      properties,
      distinct_id: distinctId,
    });
  });

  it("should catch error and log it when axios.post rejects", async () => {
    // Arrange: simulate axios.post rejecting.
    const errorMessage = "Network Error";
    mockedAxios.post.mockRejectedValue(new Error(errorMessage));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const distinctId = "user123";
    const event = "fail_event";

    // Act: call captureEvent (the error is caught inside the method).
    await service.captureEvent(distinctId, event);

    // Assert: check that console.error was called with proper error message.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "PostHog event failed:",
      errorMessage
    );

    // Restore console.error.
    consoleErrorSpy.mockRestore();
  });
});
