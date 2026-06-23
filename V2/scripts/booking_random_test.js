import http from 'k6/http';
import { check, sleep } from 'k6';

// Run with exactly 100 virtual users making 1 random booking request each concurrently
export let options = {
  vus: 100,
  iterations: 100,
  thresholds: {
    // We expect some bookings to fail due to date overlaps (409 Conflict), which is normal concurrency behavior
    http_req_failed: ['rate < 1.0'],
  },
};

const BASE_URL = 'http://12.34.56.78:80'; // Change this to your EC2 ALB / public IP in production

// 1. Setup phase: Discover active catalog rooms and authenticate 100 users
export function setup() {
  console.log('🔄 Setting up: Discovering catalog rooms...');
  let roomIds = [];
  
  // Fetch all hotels
  let hotelsRes = http.get(`${BASE_URL}/api/catalog/hotels`);
  if (hotelsRes.status === 200) {
    const hotels = JSON.parse(hotelsRes.body);
    
    // Fetch rooms for each hotel dynamically
    for (let hotel of hotels) {
      let roomsRes = http.get(`${BASE_URL}/api/catalog/hotels/${hotel.id}/rooms`);
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

  console.log(`✅ Setup: Discovered ${roomIds.length} available rooms in the catalog (Room IDs: ${roomIds.join(', ')}).`);

  // Fallback to room IDs 1-4 if catalog query yielded nothing
  if (roomIds.length === 0) {
    roomIds = [1, 2, 3, 4];
    console.log('⚠️ No active rooms discovered. Falling back to default Room IDs [1, 2, 3, 4]');
  }

  console.log('🔄 Registering and logging in 100 test users...');
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
  return { tokens: tokens, roomIds: roomIds };
}

// 2. Test phase: Each VU books a random room on random dates
export default function (data) {
  const token = data.tokens[__VU - 1];
  const roomIds = data.roomIds;

  if (!token) {
    console.error(`❌ No token found for VU #${__VU}`);
    return;
  }

  // Pick a random Room ID from the list
  const randomRoomId = roomIds[Math.floor(Math.random() * roomIds.length)];

  // Generate a random date range to spread bookings (avoiding direct conflict where possible)
  const startDaysOut = Math.floor(Math.random() * 30) + 1; // 1 to 30 days from now
  const stayDuration = Math.floor(Math.random() * 4) + 1;  // 1 to 4 nights

  let checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + startDaysOut);
  let checkInStr = checkInDate.toISOString().split('T')[0];

  let checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + stayDuration);
  let checkOutStr = checkOutDate.toISOString().split('T')[0];

  const url = `${BASE_URL}/api/bookings/create`;
  const payload = JSON.stringify({
    roomId: randomRoomId,
    checkInDate: checkInStr,
    checkOutDate: checkOutStr,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `jwt_token=${token}`,
    },
  };

  // Add random micro-sleep to simulate human booking delay differences
  sleep(Math.random() * 0.1);

  let res = http.post(url, payload, params);

  // We expect:
  // - 200 OK (booking successfully secured)
  // - OR 409 Conflict (two VUs picked overlapping dates for the same room)
  check(res, {
    'is status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });
}
