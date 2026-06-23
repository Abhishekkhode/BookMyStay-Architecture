# V2 Performance Benchmarks & Concurrency Report

This directory contains the load testing scripts, configuration results, and metric reports comparing the Hotel Booking System's performance before and after executing critical backend catalog optimizations.


## 📂 Directory Structure

```
v2/
├── README.md                           # Performance comparison, analysis, and execution guide
├── before-optimization/                # Metric results before backend enhancements
│   ├── initial_200_vus_results.json    # 200 VU catalog load test
│   ├── initial_500_vus_slow_results.json # 500 VU catalog load test (pre-crash phase)
│   └── initial_500_vus_failure_results.json # 500 VU catalog test (db connection pool failure)
├── after-optimization/                 # Metric results after backend enhancements
│   ├── after_200_vus_results.json      # 200 VU catalog load test
│   ├── after_500_vus_results.json      # 500 VU catalog load test
│   ├── booking_race_test_results.json  # 100 VU single-room race test
│   └── booking_random_test_results.json # 100 VU random room/date booking test
├── scripts/                            # k6 test scripts
│   ├── catalog_load_test.js            # GET /api/catalog/hotels load script
│   ├── booking_race_test.js            # Single-room race condition script
│   └── booking_random_test.js          # Random booking generator script
└── screenshots/                        # Grafana outputs & CloudWatch Dashboards 
```

> [!NOTE]
> - Images Labled in [`v2/screenshots/`](./screenshots/) are divided into 2 main groups
>   - V1 - Represents Metrics before Optimization.
>   - V2 - Represents Metrics after Optimization.


## 🚀 Performance Comparison Matrix (GET `/api/catalog/hotels`)

Below is the comparison of load testing the hotel catalog endpoint before and after resolving the **JPA N+1 database queries** (via eager collection fetch joins) and implementing the **Redis Catalog Cache** (5-minute TTL).

### 200 Virtual Users (VU) Load Test
| Metric | Before Optimization | After Optimization | Change | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Request Rate** | 1,437.60 req/s | **2,551.83 req/s** | **+77.5%** | 🟢 Succeeded |
| **Avg Latency** | 49.85 ms | **34.05 ms** | **-31.7%** | 🟢 Succeeded |
| **Median Latency** | 28.10 ms | **30.06 ms** | +7.0% | 🟢 Succeeded |
| **95th Percentile (P95)** | 141.52 ms | **65.43 ms** | **-53.8%** | 🟢 Succeeded |
| **Failed Requests** | 0.00% | **0.00%** | Stable | 🟢 Succeeded |

### 500 Virtual Users (VU) Load Test
| Metric | Before Optimization (Struggling) | Before Optimization (Crashed) | After Optimization (Stable) | Change (Before vs. After) |
| :--- | :--- | :--- | :--- | :--- |
| **Request Rate** | 1,722.75 req/s | 82.22 req/s | **2,687.66 req/s** | **+56.0%** (vs. struggling) |
| **Avg Latency** | 144.79 ms | 10.48 ms (failed connect) | **92.49 ms** | **-36.1%** |
| **P(95) Latency** | 612.46 ms | 18.60 ms (failed connect) | **178.76 ms** | **-70.8%** |
| **Error Rate** | 0.00% | **100.00% (DB Starve)** | **0.00%** | **Fixed Crashes** |

### ⚠️ Initial Failures Explanation
* **500 VU Crash**: In the original unoptimized setup, fetching hotels invoked separate SQL queries for each hotel's images (N+1 query behavior). Under 500 VUs, the application exhausted PostgreSQL's connection pool, causing CPU spikes and database starvation, leading to a **100% failure rate** as connection timeouts blocked Spring Boot completely.
* **The Solution**: We implemented a `LEFT JOIN FETCH h.imageUrls` in the repository layer to consolidate queries and cached the results in Redis with a 5-minute TTL. Latency dropped by up to **70.8%**, and CPU utilization stayed normal.


## 🔒 Concurrency & Locking Validation

We ran two specialized tests to check for race conditions and date overlap prevention at `100 VUs`.

### 1. Single-Room Race Condition [`booking_race_test.js`](./scripts/booking_race_test.js)
* **Objective**: Force 100 authenticated virtual users to attempt to book the **exact same room** on the **exact same check-in/check-out dates** concurrently.
* **Result**:
  * **1 Booking Succeeded** (`200 OK`)
  * **99 Bookings Rejected** (`409 Conflict`)
  * **Check success rate (`is status 200 or 409`)**: **100%**
* **Verification**: This confirms that the **database-level pessimistic write lock** successfully blocks race conditions, securing the room for only one customer and avoiding double bookings.

### 2. Multi-Room Random Bookings [`booking_random_test.js`](./scripts/booking_random_test.js)
* **Objective**: Simulates 100 virtual users booking a variety of rooms (Room IDs 1-5) on random dates scattered across 30 days.
* **Result**:
  * **44 Bookings Succeeded** (`200 OK`)
  * **56 Bookings Rejected** (`409 Conflict`)
  * **Check success rate**: **100%**
* **Verification**: Bookings that did not overlap went through, while overlapping dates were cleanly rejected by the business logic validation, proving that the inventory rules remain robust under heavy concurrency.


## 🛠️ How to Re-Run Benchmarks

Make sure `k6` is installed on your local machine, and execute the scripts directly from this directory:

### Run Catalog Load Test
```bash
k6 run scripts/catalog_load_test.js
```

### Run Concurrency Race Condition Test
```bash
k6 run scripts/booking_race_test.js
```

### Run Random Booking Concurrency Test
```bash
k6 run scripts/booking_random_test.js
```


## 🖥️ System-Level Metrics

Right now, most metrics are request-focused. To get a complete overview of resource consumption under load, we monitor the following system-level metrics:

| Metric               | Before  |     After     |
|:---------------------|:-------:|:-------------:|
| **EC2 CPU**          |  58.7%  |     52.7%     |
| **RDS CPU**          |  49.3%  |     4.3%      |
| **EC2 Mem Used**     |  68.5%  |     75.4%     |
| **Redis Cache Hits** | 0 Count | 146.38k Count |

## Observations
- RDS CPU utilization dropped from 49.3% to 4.3%, confirming that Redis caching significantly reduced database load.
- Redis served over 146k cache hits during testing, reducing repetitive catalog queries.
- EC2 memory utilization increased moderately due to cache population and higher request throughput, which was expected and remained within safe operating limits.


## 🔑 Key Findings

* **Query Inefficiency Bottleneck**: The largest bottleneck was not raw CPU but database query inefficiency (the JPA N+1 collection fetch problem).
* **Round Trip Reduction**: Eliminating unnecessary database round trips produced larger gains than vertical scaling of instances.
* **Prevention vs Mitigation**: Caching reduced catalog read latency, but fixing the underlying database query design is what prevented database connection pool exhaustion.
* **Correctness Under Concurrency**: Concurrency correctness (pessimistic lock isolation to prevent double bookings) is as important as high throughput in reservation-based booking systems.

## ☁️ AWS Takeaways

- This phase demonstrated how CloudWatch metrics, Redis caching, and load testing can be used together to identify bottlenecks and validate infrastructure decisions.

- Rather than scaling resources vertically, performance gains were achieved by reducing unnecessary database load and verifying the impact through AWS monitoring services.

*AWS learner building production-inspired cloud architectures and validating them through monitoring and load testing.*



