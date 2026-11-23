// Merges the unit and E2E coverage reports (coverage/unit, coverage/e2e)
// into coverage/merged, printing a summary and writing an HTML report.
// Usage: npm run test:cov && npm run test:e2e:cov && npm run coverage:merge
const fs = require('fs');
const path = require('path');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const root = path.join(__dirname, '..', 'coverage');
const map = libCoverage.createCoverageMap({});

for (const suite of ['unit', 'e2e']) {
  const file = path.join(root, suite, 'coverage-final.json');
  if (!fs.existsSync(file)) {
    console.error(
      `Missing ${file}; run the ${suite} tests with coverage first.`,
    );
    process.exit(1);
  }
  map.merge(JSON.parse(fs.readFileSync(file, 'utf8')));
}

const context = libReport.createContext({
  dir: path.join(root, 'merged'),
  coverageMap: map,
});
for (const reporter of ['text-summary', 'html']) {
  reports.create(reporter).execute(context);
}
