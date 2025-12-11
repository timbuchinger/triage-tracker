#!/usr/bin/env node
const { main } = require('./generate-slack-manifest');

async function run() {
  const argv = process.argv.slice(2);
  await main(argv);
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
