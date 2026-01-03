import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Test timeout (30 seconds to accommodate Bedrock calls in integration tests)
    testTimeout: 30000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'build/',
        'src/index.ts', // MCP server entry point - integration test separately
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
      ],
      // Coverage thresholds
      // thresholds: {
      //   lines: 70,
      //   functions: 70,
      //   branches: 65,
      //   statements: 70,
      // },
    },
    setupFiles: ['./tests/setup.ts'],

    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Reporter configuration
    reporters: process.env.CI ? ['verbose', 'junit'] : ['verbose'],

    // Output configuration for CI
    outputFile: {
      junit: './coverage/junit.xml',
    },

    // Include/exclude patterns
    include: ['tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
});
