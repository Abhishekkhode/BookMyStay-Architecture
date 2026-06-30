# V3 High Availability Cloud Architecture & Load Testing Benchmarks

This directory documents the **V3 High Availability Architecture** of the BookMyStay Booking System. By shifting from a single-node host to a distributed, autoscaling, load-balanced cloud topology, the system was validated to support up to **1,500+ concurrent Virtual Users (VUs)** with **0.00% error rates** and sub-20ms average latencies.

---

## 🗺️ High-Availability Architecture Overview

The system is deployed using a standard secure 3-tier web architecture, detailed in the diagram:
* **Architecture Diagram**: [3-Teir.drawio (6).png](./3-Teir.drawio%20%286%29.png)

```
                       [ Internet Users ]
                               │
                               ▼
                [ Application Load Balancer ] (ALB)
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   [ Auto Scaling Group ]                [ Auto Scaling Group ]
   (EC2 Instance - AZ A)                 (EC2 Instance - AZ B)
            │                                     │
            └──────────┬──────────────┬───────────┘
                       │              │
                       ▼              ▼
               [ Redis Cache ]   [ PostgreSQL Database ]
```

### Key Infrastructure Components:
1. **Application Load Balancer (ALB)**: Exposes a single DNS entry and routes incoming traffic across multiple target groups dynamically.
2. **Auto Scaling Group (ASG)**: Scales the EC2 web application instances horizontally based on target tracking policies (CPU/Memory utilization thresholds).
3. **Multi-AZ Network Design**: Distributes instances across multiple Availability Zones (AZs) inside public (ALB) and private (App/DB/Cache) subnets for maximum isolation and disaster recovery.

---

## ⚠️ AWS Resource & Credit Limits Notice

> [!WARNING]
> **Multi-AZ Database & Cache Replication Constraints:**
> While the cloud topology is fully designed and configured for Multi-AZ databases (PostgreSQL standby replicas) and Multi-AZ caching (Redis replication groups across subnets), these Multi-AZ clusters were **not actively deployed in the live AWS testing sandbox due to AWS Free Tier/Credit limit constraints**. 
>
> To control costs, Single-AZ database and cache instances with multi-subnet access groups were used for validation, though the architecture is fully prepared to scale to Multi-AZ production clusters at any time.

---

## 📈 Load Testing & Scaling Progression (k6 Benchmarks)

We executed load tests across 4 key stages to validate the distributed systems under varying traffic volumes. All tests simulated a realistic traffic mix: **70% Catalog Reads, 20% Availability Lookups, and 10% Room Detail Queries**.

### 1. Stage 1: Base Baseline (500 VUs)
* **Script**: [stage1.js](./scripts/stage1.js)
* **Goal**: Validate stability under standard load using the Application Load Balancer endpoint.
* **Result**: Safe, stable operation with 0% error rates.
* **Screenshot**: [Stage 1 results.png](./screenshorts/Stage%201%20results.png)

---

### 2. Stage 2: Scaling Stress Test (1,000 VUs)
To test scaling dynamics, we doubled the concurrent load to 1,000 VUs. This stage reveals the power of automatic horizontal scaling:

#### Phase A: Peak Load / Pre-Scale Event (Failure Phase)
* **Results**: [stage2.json](./results/stage2.json) / [stage2-1.json](./results/stage2-1.json)
* **Metric Data**: Error rate peaked at **38.24% - 41.06%**. 
* **Observations**: Under the sudden traffic surge, database connections starved and a single EC2 instance reached its limits. The room availability endpoint suffered a 100% check failure rate due to connection timeouts.
* **Screenshots**: [Stage 2 results.png](./screenshorts/Stage%202%20results.png)

#### Phase B: Horizontal Auto Scaling Active (Success Phase)
* **Results**: [stage2-2.json](./results/stage2-2.json)
* **Metric Data**: **0.00% Error Rate** (714,355 out of 714,355 checks passed).
* **Latencies**: Average response latency dropped to **10.45 ms**, and P95 latency dropped to **18.12 ms**.
* **Observations**: The CloudWatch CPU utilization alarm triggered, prompting the Auto Scaling Group to launch a second EC2 instance. The ALB immediately distributed the load, returning latencies and error rates to elite levels.
* **Screenshots**: [Stage 2-2.png](./screenshorts/Stage%202-2.png) / [Stage 2 -2 results.png](./screenshorts/Stage%202%20-2%20results.png)

---

### 3. Stage 3: High Concurrency Peak Test (1,500 VUs)
* **Script**: [stage3.js](./scripts/stage3.js) | **Results**: [stage3.json](./results/stage3.json)
* **Metric Data**: **99.999% Check Success Rate** (only 1 failed request out of 677,805 total requests).
* **Throughput**: Sustained **1,025 requests/second**.
* **Latencies**: Average latency remained at **11.24 ms** with a P95 of **19.04 ms**.
* **Observations**: System stability is fully verified at 1,500 VUs. The combination of ALB load balancing, ASG horizontal scaling, and ElastiCache Redis read-caching successfully handles extreme concurrency.
* **Screenshots**: [Stage 3.png](./screenshorts/Stage%203.png) / [CloudWatch Stage 3.png](./screenshorts/CloudWatch%20Stage%203.png)

---

### 4. Stage 4: Extreme Peak Stress Test (2,000 VUs)
* **Script**: [stage4.js](./scripts/stage4.js)
* **Goal**: Pushing the absolute limits of the distributed system to evaluate target scaling policy response times.

---

## 🛠️ How to Re-run Load Tests

1. Ensure `k6` is installed.
2. Export your ALB endpoint environment variable:
   ```bash
   export BASE_URL="Replace With Your ALB URL"
   ```
3. Run the target script:
   ```bash
   k6 run scripts/stage1.js
   k6 run scripts/stage2.js
   k6 run scripts/stage3.js
   k6 run scripts/stage4.js
   ```

---

## 💡 Key Architectural Insights

* **Observability-Driven Diagnosis**: Utilizing AWS CloudWatch dashboard telemetry (monitoring metrics like EC2 CPU, RDS Freeable Memory, and Redis hit counters side-by-side) made it possible to locate systemic bottlenecks instantly without guessing or digging through raw application log files.
* **Auto-Scaling Dynamics**: Shifting the workload from a single application instance to a target-tracking Auto Scaling Group completely resolved the connection pool starvation seen at 1,000 VUs. Distributing connection handshakes across multiple scaled EC2 instances allowed the application layer to scale compute independently of the data storage layer.
* **Network & Routing Offloading**: Using the Application Load Balancer (ALB) to handle incoming request traffic and perform health checks prevented individual EC2 nodes from bottlenecking on TCP handshake limits under extreme spikes.

---

## 🎓 Engineering Learnings

* **Horizontal Scaling > Vertical Scaling**: While upgrading server size (vertical scaling) provides temporary relief, horizontal scaling through an ASG and ALB is far more resilient. It eliminates single points of failure (SPOF) and adjusts cost dynamically according to real-time traffic demand.
* **Database Connection Limits**: In high-concurrency systems, the database connection pool is often the hardest bottleneck to resolve. Even if application instances scale infinitely, the database can only handle a set number of concurrent write locks. Optimizing query execution time and using read-caching are vital to preserving database connection capacity.
* **Caching Location Strategy**: Placing the caching layer (Redis) directly in front of the application nodes protects the relational database from high-volume read traffic. Offloading read requests to an in-memory cache preserves PostgreSQL database resources for writing booking transactions.

---

## 🏁 Conclusion

The V3 architecture successfully transitioned the BookMyStay Booking System from a fragile, single-node application into a resilient, production-ready distributed cloud system. 

By combining horizontal auto-scaling, intelligent caching, load balancing, and pessimistic transactional locking, the system proved it can support high traffic volumes (**1,500+ concurrent loops**) with **virtually zero errors (0.00%)** and sub-20ms latencies. This iteration validates that monitoring, load testing, and caching are fundamental pillars of modern, reliable cloud architectures.

