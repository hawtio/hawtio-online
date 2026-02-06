import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    // Attempt a 50-user burst against a server with a limit of 10
    intentional_fail: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '10s',
    },
  },
  thresholds: {
    // SUCCESS CRITERIA:
    // We expect AT LEAST 50% of requests to fail (return 429).
    // If Nginx accepts everything (rate=0), this test FAILS.
    'http_req_failed': ['rate>0.5'],
  },
}

export default function () {
  const BASE_URL = 'http://localhost:8080'

  // Hit the Master endpoint
  const res = http.get(`${BASE_URL}/master/api/v1/namespaces`)

  check(res, {
    // We are looking for 429 Too Many Requests
    'Rate Limit Working (429)': (r) => r.status === 429,
  })
}
