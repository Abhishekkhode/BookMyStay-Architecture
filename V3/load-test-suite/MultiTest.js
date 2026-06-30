import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

/* ================= METRICS ================= */

const catalogReq = new Counter("catalog_requests");
const availReq = new Counter("availability_requests");
const randomBookReq = new Counter("random_booking_requests");
const hotspotBookReq = new Counter("hotspot_booking_requests");

const catalogLatency = new Trend("catalog_latency");
const availLatency = new Trend("availability_latency");
const randomBookLatency = new Trend("random_booking_latency");
const hotspotBookLatency = new Trend("hotspot_booking_latency");

const bookingSuccess = new Counter("booking_success");
const bookingConflict = new Counter("booking_conflict");
const errors = new Counter("errors");

/* ================= CONFIG ================= */

const BASE_URL = "Replace with your ALB URL";

export const options = {
  vus: 100,
  iterations: 100,

  thresholds: {
    http_req_failed: ["rate < 1"],
  },
};

/* ================= SETUP ================= */

export function setup() {
  console.log("🔄 Setting up rooms + users...");

  let roomIds = [];

  let hotelsRes = http.get(`${BASE_URL}/api/catalog/hotels`);

  if (hotelsRes.status === 200) {
    const hotels = JSON.parse(hotelsRes.body);

    for (let hotel of hotels) {
      let roomsRes = http.get(
        `${BASE_URL}/api/catalog/hotels/${hotel.id}/rooms`
      );

      if (roomsRes.status === 200) {
        const rooms = JSON.parse(roomsRes.body);
        for (let room of rooms) {
          if (room.available) {
            roomIds.push(room.id);
          }
        }
      }
    }
  }

  if (roomIds.length === 0) {
    roomIds = [1, 2, 3, 4];
  }

  console.log(`✅ Rooms found: ${roomIds.length}`);

  let tokens = [];

  for (let i = 1; i <= 100; i++) {
    const email = `testuser${i}@hotel.com`;
    const password = "password";

    http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ email, password }),
      { headers: { "Content-Type": "application/json" } }
    );

    let loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { "Content-Type": "application/json" } }
    );

    if (loginRes.status === 200) {
      const match =
        loginRes.headers["Set-Cookie"]?.match(/jwt_token=([^;]+)/);

      if (match) tokens.push(match[1]);
    }
  }

  console.log(`✅ Users ready: ${tokens.length}`);

  return { tokens, roomIds };
}

/* ================= HELPERS ================= */

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/* ================= MAIN TEST ================= */

export default function (data) {
  const r = Math.random();
  const token = data.tokens[__VU - 1];
  const roomIds = data.roomIds;

  sleep(Math.random() * 0.2);

  /* ================= 60% CATALOG ================= */
  if (r < 0.6) {
    catalogReq.add(1);

    const res = http.get(`${BASE_URL}/api/catalog/hotels`);

    catalogLatency.add(res.timings.duration);

    check(res, { "catalog ok": (r) => r.status === 200 });

    return;
  }

  /* ================= 20% AVAILABILITY ================= */
  if (r < 0.8) {
    availReq.add(1);

    const roomId = random(roomIds);

    const res = http.get(
      `${BASE_URL}/api/catalog/rooms/${roomId}/check-availability?checkIn=${future(
        5
      )}&checkOut=${future(10)}`
    );

    availLatency.add(res.timings.duration);

    check(res, { "availability ok": (r) => r.status === 200 });

    return;
  }

  /* ================= 10% RANDOM BOOKING ================= */
  if (r < 0.9) {
    randomBookReq.add(1);

    const roomId = random(roomIds);

    const payload = JSON.stringify({
      roomId,
      checkInDate: future(Math.floor(Math.random() * 20 + 1)),
      checkOutDate: future(Math.floor(Math.random() * 25 + 2)),
    });

    const res = http.post(
      `${BASE_URL}/api/bookings/create`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `jwt_token=${token}`,
        },
      }
    );

    randomBookLatency.add(res.timings.duration);

    if (res.status === 200) bookingSuccess.add(1);
    else if (res.status === 409) bookingConflict.add(1);
    else errors.add(1);

    check(res, {
      "booking ok/conflict": (r) =>
        r.status === 200 || r.status === 409,
    });

    return;
  }

  /* ================= 10% HOTSPOT BOOKING ================= */
  hotspotBookReq.add(1);

  const payload = JSON.stringify({
    roomId: roomIds[0],
    checkInDate: "2026-08-20",
    checkOutDate: "2026-08-25",
  });

  const res = http.post(
    `${BASE_URL}/api/bookings/create`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: `jwt_token=${token}`,
      },
    }
  );

  hotspotBookLatency.add(res.timings.duration);

  if (res.status === 200) bookingSuccess.add(1);
  else if (res.status === 409) bookingConflict.add(1);
  else errors.add(1);

  check(res, {
    "hotspot booking ok/conflict": (r) =>
      r.status === 200 || r.status === 409,
  });
}