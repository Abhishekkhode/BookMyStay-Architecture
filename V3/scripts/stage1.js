import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const catalogLatency = new Trend("catalog_latency", true);
const availabilityLatency = new Trend("availability_latency", true);
const bookingLatency = new Trend("booking_latency", true);
const errorRate = new Rate("error_rate");
const totalRequests = new Counter("total_requests");

const BASE_URL = __ENV.BASE_URL || "Replace With Your ALB URL";

const TRAFFIC = { catalog: 0.7, availability: 0.2, rooms: 0.1 };

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

export const options = {
  stages: [
    { duration: "3m", target: 500 },
    { duration: "12m", target: 500 },
    { duration: "2m", target: 0 }
  ]
};

export default function () {
  const r = Math.random();

  if (r < TRAFFIC.catalog) {
    group("catalog", () => {
      const res = http.get(`${BASE_URL}/api/catalog/hotels`);

      catalogLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      totalRequests.add(1);

      check(res, {
        "catalog ok": (r) => r.status === 200
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

      availabilityLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      totalRequests.add(1);

      check(res, {
        "availability ok": (r) => r.status === 200
      });
    });

  } else {
    group("rooms", () => {
      const hotelId = random(HOTEL_IDS);

      const res = http.get(
        `${BASE_URL}/api/catalog/hotels/${hotelId}/rooms`
      );

      bookingLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      totalRequests.add(1);

      check(res, {
        "rooms ok": (r) => r.status === 200
      });
    });
  }

  sleep(Math.random() * 1.5 + 0.5);
}