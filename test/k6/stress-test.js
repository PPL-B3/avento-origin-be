import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "40s", target: 20 }, // Ramp-up from 1 to 20 users over 40 seconds.
    { duration: "40s", target: 20 }, // Stay at 20 users for 40 seconds.
    { duration: "40s", target: 0 }, // Ramp-down to 0 users over 40 seconds.
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests must complete within 2000ms.
    http_req_failed: ["rate<0.01"], // Less than 1% errors.
  },
};

const BASE_URL = "http://35.239.1.224:4000";

export default function () {
  // Test the /hello endpoint.
  let res = http.get(`${BASE_URL}/hello`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response body contains messages": (r) => r.body.includes("messages"),
  });
  sleep(1);

  // Test the /auth/login endpoint.
  const loginPayload = JSON.stringify({
    email: "ta25@gmail.com",
    password: "Momofin2025!",
  });
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };
  res = http.post(`${BASE_URL}/auth/login`, loginPayload, params);
  check(res, {
    "login status is 201": (r) => r.status === 201,
    "login response has access_token": (r) => r.json("access_token") !== null,
  });
  sleep(1);
}
