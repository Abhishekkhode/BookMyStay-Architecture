import http from 'k6/http';
import { check, sleep } from 'k6';

// Run with exactly 100 virtual users making 1 request each concurrently
export let options = {
  vus: 100,
  iterations: 100,
  thresholds: {
    // We expect 99% of requests to fail/conflict, so we don't fail the test due to HTTP failures
    http_req_failed: ['rate < 1.0'],
  },
};

const BASE_URL = 'http://12.34.56.78:80'; // Change this to your EC2 ALB / public IP in production

// 1. Setup phase: Register and login 100 distinct users to obtain their JWT tokens
export function setup() {
  console.log('🔄 Setting up: Registering and logging in 100 test users...');
  let tokens = [];

  for (let i = 1; i <= 100; i++) {
    const email = `testuser${i}@hotel.com`;
    const password = 'password';

    // Register user (ignored if already registered)
    http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ email: email, password: password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    // Login user to get JWT token
    let loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: email, password: password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (loginRes.status === 200) {
      // Extract the jwt_token cookie from the Set-Cookie header
      const setCookie = loginRes.headers['Set-Cookie'];
      if (setCookie) {
        const match = setCookie.match(/jwt_token=([^;]+)/);
        if (match && match[1]) {
          tokens.push(match[1]);
        }
      }
    }
  }

  console.log(`✅ Setup complete: Generated ${tokens.length} user JWT tokens.`);
  return { tokens: tokens };
}

// 2. Concurrency test phase: All 100 VUs make the booking request at the exact same time
export default function (data) {
  // Get the token corresponding to the current Virtual User (VU) index
  const token = data.tokens[__VU - 1];

  if (!token) {
    console.error(`❌ No token found for VU #${__VU}`);
    return;
  }

  const url = `${BASE_URL}/api/bookings/create`;
  const payload = JSON.stringify({
    roomId: 1, // Targets Room ID 1 (ensure this room exists in your database!)
    checkInDate: '2026-08-20', // Test target dates
    checkOutDate: '2026-08-25',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // Pass the JWT token as a Cookie header
      'Cookie': `jwt_token=${token}`,
    },
  };

  // Synchronize start: wait a small random time to line up all VUs, then hit the API
  sleep(Math.random() * 0.1);

  let res = http.post(url, payload, params);

  // We expect:
  // - Exactly 1 success (status 200)
  // - Exactly 99 conflicts (status 409)
  check(res, {
    'is status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });
}
