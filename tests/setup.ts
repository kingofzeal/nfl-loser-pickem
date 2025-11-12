// Global test setup
beforeAll(() => {
  // Setup before all tests
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/nfl_pickem_test';
});

afterAll(() => {
  // Cleanup after all tests
});
