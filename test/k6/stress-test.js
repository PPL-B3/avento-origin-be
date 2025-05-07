import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    // Ramp-up from 1 to 20 users over 40 seconds.
    { duration: "40s", target: 20 },
    // Stay at 20 users for 40 seconds.
    { duration: "40s", target: 20 },
    // Ramp-down to 0 users over 40 seconds.
    { duration: "40s", target: 0 },
  ],
  thresholds: {
    // 95% of requests must complete within 200ms.
    http_req_duration: ["p(95)<200"],
    // Less than 1% errors.
    http_req_failed: ["rate<0.01"],
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

  // Test a POST endpoint (e.g., /auth/login).
  // Adjust payload as necessary.
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

// To generate an HTML report (optional, using a community reporter)
// k6 run tests/k6/stress-test.js --out json=summary.json
// Then use a tool to convert summary.json to HTML, or use k6 cloud.
// Example for HTML report using k6-reporter (you'd need to install/import it)
// Refer to: https://github.com/benc-uk/k6-reporter
/*
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export function handleSummary(data) {
  return {
    "summary.html": htmlReport(data),
  };
}
*/
