module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js'],
  globalSetup: './src/tests/integration/globalSetup.js',
  globalTeardown: './src/tests/integration/globalTeardown.js',
  setupFiles: ['./src/tests/integration/envSetup.js'],
  setupFilesAfterEnv: ['./src/tests/setup.js', './src/tests/integration/testSetup.js'],
  testTimeout: 15000,
};
