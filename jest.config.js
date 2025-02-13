module.exports = {
  roots: ['<rootDir>/src'],
  // This pattern will match files ending with .spec.ts or .test.ts in any folder under src
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
};
