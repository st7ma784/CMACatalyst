// CMA System Load Testing Suite
// Comprehensive load testing using Artillery.js

const { test } = require('@playwright/test');

// Load Testing Configuration
const LOAD_TEST_CONFIG = {
  target: process.env.TEST_URL || 'http://localhost:5000',
  phases: [
    { duration: 60, arrivalRate: 5, name: 'Warm up' },
    { duration: 120, arrivalRate: 10, name: 'Ramp up load' },
    { duration: 300, arrivalRate: 20, name: 'Sustained load' },
    { duration: 120, arrivalRate: 50, name: 'Peak load' },
    { duration: 60, arrivalRate: 5, name: 'Cool down' }
  ],
  payload: {
    path: './test-data.csv',
    fields: ['username', 'password', 'client_id', 'case_id']
  }
};

// Artillery.js Configuration Export
module.exports = {
  config: {
    target: LOAD_TEST_CONFIG.target,
    phases: LOAD_TEST_CONFIG.phases,
    payload: LOAD_TEST_CONFIG.payload,
    processor: './load-test-processor.js',
    plugins: {
      'artillery-plugin-metrics-by-endpoint': {
        useOnlyRequestNames: true
      }
    }
  },
  scenarios: [
    {
      name: 'Authentication Load Test',
      weight: 20,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              username: '{{ username }}',
              password: '{{ password }}'
            },
            capture: {
              json: '$.token',
              as: 'authToken'
            }
          }
        },
        {
          think: 2
        },
        {
          get: {
            url: '/api/auth/me',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        }
      ]
    },
    {
      name: 'Client Management Load Test',
      weight: 30,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              username: '{{ username }}',
              password: '{{ password }}'
            },
            capture: {
              json: '$.token',
              as: 'authToken'
            }
          }
        },
        {
          get: {
            url: '/api/clients',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          think: 1
        },
        {
          get: {
            url: '/api/clients/{{ client_id }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          think: 3
        },
        {
          post: {
            url: '/api/clients',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            json: {
              first_name: 'Load{{ $randomString() }}',
              last_name: 'Test{{ $randomString() }}',
              email: 'loadtest{{ $randomInt(1, 10000) }}@example.com',
              phone: '07700{{ $randomInt(100000, 999999) }}',
              address: '{{ $randomInt(1, 999) }} Test Street'
            }
          }
        }
      ]
    },
    {
      name: 'Case Management Load Test',
      weight: 25,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              username: '{{ username }}',
              password: '{{ password }}'
            },
            capture: {
              json: '$.token',
              as: 'authToken'
            }
          }
        },
        {
          get: {
            url: '/api/cases',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          think: 2
        },
        {
          get: {
            url: '/api/cases/{{ case_id }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          think: 1
        },
        {
          get: {
            url: '/api/cases/{{ case_id }}/notes',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          post: {
            url: '/api/cases/{{ case_id }}/notes',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            json: {
              content: 'Load test note {{ $timestamp() }}',
              category: 'General',
              is_private: false
            }
          }
        }
      ]
    },
    {
      name: 'Dashboard Load Test',
      weight: 15,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              username: '{{ username }}',
              password: '{{ password }}'
            },
            capture: {
              json: '$.token',
              as: 'authToken'
            }
          }
        },
        {
          get: {
            url: '/api/centres/1/stats',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          get: {
            url: '/api/cases?limit=5',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        },
        {
          get: {
            url: '/api/appointments?start_date={{ $timestamp() }}&limit=5',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            }
          }
        }
      ]
    },
    {
      name: 'AI Workflow Load Test',
      weight: 10,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              username: '{{ username }}',
              password: '{{ password }}'
            },
            capture: {
              json: '$.token',
              as: 'authToken'
            }
          }
        },
        {
          post: {
            url: '/api/agentic-workflow/execute',
            headers: {
              Authorization: 'Bearer {{ authToken }}'
            },
            json: {
              workflow_type: 'COMPREHENSIVE_CASE_REVIEW',
              case_id: '{{ case_id }}',
              parameters: {
                include_risk_assessment: true,
                generate_advice_letter: false
              }
            }
          }
        }
      ]
    }
  ]
};

// Load Test Data Generator
function generateTestData() {
  const users = [];
  const clients = [];
  const cases = [];
  
  // Generate test users
  for (let i = 1; i <= 50; i++) {
    users.push({
      username: `loadtest_user_${i}`,
      password: 'loadtest123',
      role: i <= 10 ? 'manager' : 'advisor'
    });
  }
  
  // Generate test clients
  for (let i = 1; i <= 200; i++) {
    clients.push({
      id: i,
      first_name: `Client${i}`,
      last_name: `Test${i}`,
      email: `client${i}@loadtest.com`,
      phone: `07700${String(i).padStart(6, '0')}`,
      address: `${i} Load Test Street`
    });
  }
  
  // Generate test cases
  for (let i = 1; i <= 300; i++) {
    cases.push({
      id: i,
      case_number: `LOAD${String(i).padStart(4, '0')}`,
      client_id: Math.floor(Math.random() * 200) + 1,
      debt_stage: ['Assessment', 'Advice', 'Implementation', 'Monitoring'][Math.floor(Math.random() * 4)],
      priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)]
    });
  }
  
  return { users, clients, cases };
}

// Performance Benchmarks
const PERFORMANCE_BENCHMARKS = {
  response_times: {
    p95_threshold: 2000, // 95th percentile should be under 2 seconds
    p99_threshold: 5000, // 99th percentile should be under 5 seconds
    mean_threshold: 500   // Mean response time should be under 500ms
  },
  error_rates: {
    max_error_rate: 0.01 // Maximum 1% error rate
  },
  throughput: {
    min_rps: 50 // Minimum 50 requests per second
  }
};

// Database Load Testing
const DATABASE_LOAD_TESTS = {
  concurrent_connections: {
    max_connections: 100,
    test_duration: 300 // 5 minutes
  },
  query_performance: {
    complex_queries: [
      'SELECT * FROM cases c JOIN clients cl ON c.client_id = cl.id WHERE c.created_at > NOW() - INTERVAL \'30 days\'',
      'SELECT COUNT(*) FROM notes WHERE created_at BETWEEN $1 AND $2 GROUP BY DATE(created_at)',
      'SELECT c.*, COUNT(n.id) as note_count FROM cases c LEFT JOIN notes n ON c.id = n.case_id GROUP BY c.id'
    ]
  }
};

// Memory and CPU Load Testing
const RESOURCE_MONITORING = {
  memory_usage: {
    max_heap_size: '2GB',
    gc_frequency_threshold: 10 // GC should not run more than 10 times per minute
  },
  cpu_usage: {
    max_cpu_percentage: 80,
    sustained_load_duration: 300 // 5 minutes
  }
};

// Export for Artillery CLI usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports.generateTestData = generateTestData;
  module.exports.PERFORMANCE_BENCHMARKS = PERFORMANCE_BENCHMARKS;
  module.exports.DATABASE_LOAD_TESTS = DATABASE_LOAD_TESTS;
  module.exports.RESOURCE_MONITORING = RESOURCE_MONITORING;
}
