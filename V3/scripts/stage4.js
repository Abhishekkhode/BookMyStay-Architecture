

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// Latency Metrics
const catalogLatency = new Trend("catalog_latency", true);
const availabilityLatency = new Trend("availability_latency", true);
const bookingLatency = new Trend("booking_latency", true);

// General Metrics
const errorRate = new Rate("error_rate");
const totalRequests = new Counter("total_requests");

// Status Code Counters
const status200 = new Counter("status_200");
const status400 = new Counter("status_400");
const status403 = new Counter("status_403");
const status404 = new Counter("status_404");
const status500 = new Counter("status_500");
const status502 = new Counter("status_502");
const status503 = new Counter("status_503");
const status504 = new Counter("status_504");

const BASE_URL =
  __ENV.BASE_URL ||
  "Replace With Your ALB URL";


const TRAFFIC = {
  catalog: 0.7,
  availability: 0.2,
  rooms: 0.1,
};

const ROOM_IDS = [1, 2, 3, 4, 5];
const HOTEL_IDS = [1, 2, 3];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function recordStatus(res) {
  switch (res.status) {
    case 200:
      status200.add(1);
      break;
    case 400:
      status400.add(1);
      break;
    case 403:
      status403.add(1);
      break;
    case 404:
      status404.add(1);
      break;
    case 500:
      status500.add(1);
      break;
    case 502:
      status502.add(1);
      break;
    case 503:
      status503.add(1);
      break;
    case 504:
      status504.add(1);
      break;
  }
}

export const options = {
  stages: [
    { duration: "1m", target: 2000 },
    { duration: "8m", target: 2000 },
    { duration: "2m", target: 0 },
  ],
};

export default function () {
  const r = Math.random();

  if (r < TRAFFIC.catalog) {
    group("catalog", () => {
      const res = http.get(`${BASE_URL}/api/catalog/hotels`);

      recordStatus(res);

      catalogLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      totalRequests.add(1);

      check(res, {
        "catalog ok": (r) => r.status === 200,
      });
    });
  } else if (r < TRAFFIC.catalog + TRAFFIC.availability) {
    group("availability", () => {
      const roomId = random(ROOM_IDS);

      const checkIn = future(5);
      const checkOut = future(10);

      const res = http.get(
        `${BASE_URL}/api/catalog/rooms/${roomId}/check-availability?checkIn=${checkIn}&checkOut=${checkOut}`
      );

      recordStatus(res);

      availabilityLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      totalRequests.add(1);

      check(res, {
        "availability ok": (r) => r.status === 200,
      });
    });
  } else {
    group("rooms", () => {
      const hotelId = random(HOTEL_IDS);

      const res = http.get(
        `${BASE_URL}/api/catalog/hotels/${hotelId}/rooms`
      );

      recordStatus(res);

      bookingLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      totalRequests.add(1);

      check(res, {
        "rooms ok": (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 1.5 + 0.5);
}