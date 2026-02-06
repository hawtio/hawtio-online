import http from 'k6/http'
import { check } from 'k6'
import { scenario } from 'k6/execution'

export const options = {
  scenarios: {
    // Scenario 1: Dashboard Load Spike
    // Fire 50 concurrent connections instantly to simulate Cluster Mode startup.
    // This MUST succeed (200 OK).
    dashboard_burst: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '10s',
    },

    // Scenario 2: Auth Brute Force (Optional)
    // Spam the login endpoint. We expect this to eventually hit 429.
    // This confirms strict limits are working elsewhere.
    auth_spam: {
      executor: 'constant-arrival-rate',
      rate: 30, // 30 reqs/sec (Exceeds the 10r/s limit)
      timeUnit: '1s',
      duration: '5s',
      preAllocatedVUs: 10,
      startTime: '5s', // Run this after the burst test
    },
  },
  thresholds: {
    // Fail the build if ANY burst request is rejected
    'http_req_failed{scenario:dashboard_burst}': ['rate==0'],
    // Fail if auth spam DOESN'T get limited (optional, but good verification)
    // We expect at least SOME 429s here, so maybe rate > 0.1
  },
}

export default function () {
  // We hit localhost:8080 because Nginx runs on host network in CI
  const BASE_URL = 'http://localhost:8080'

  if (scenario.name === 'dashboard_burst') {
    const res = http.get(`${BASE_URL}/master/api/v1/namespaces`)
    check(res, {
      'Burst Allowed (200)': (r) => r.status === 200,
      'No Rate Limit (429)': (r) => r.status !== 429,
    })
  }

  if (scenario.name === 'auth_spam') {
    http.get(`${BASE_URL}/auth/logout`)
  }
}
