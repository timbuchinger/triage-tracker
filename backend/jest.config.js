module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: {
    '^.+\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.(t|j)s',
    '!**/main.(t|j)s',
    '!**/dto/**',
    '!**/worker/**',
    '!**/prisma*.ts'
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
