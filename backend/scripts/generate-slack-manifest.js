#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

async function main(argv = process.argv.slice(2)) {
  let envFile = '';
  if (argv[0] === '--env-file') {
    envFile = argv[1] || '';
  }

  const ROOT_DIR = path.resolve(__dirname, '..');
  const candidate1 = path.join(ROOT_DIR, 'integrations', 'slack', 'manifest.template.yml');
  const candidate2 = path.join(ROOT_DIR, 'docs', 'integrations', 'slack', 'manifest.template.yml');
  let TEMPLATE = candidate1;
  let OUT = path.join(ROOT_DIR, 'integrations', 'slack', 'manifest.yml');

  if (fs.existsSync(candidate1)) {
    TEMPLATE = candidate1;
    OUT = path.join(ROOT_DIR, 'integrations', 'slack', 'manifest.yml');
  } else if (fs.existsSync(candidate2)) {
    TEMPLATE = candidate2;
    OUT = path.join(ROOT_DIR, 'docs', 'integrations', 'slack', 'manifest.yml');
  } else {
    // default to original path (will error later if missing)
    TEMPLATE = candidate1;
    OUT = path.join(ROOT_DIR, 'integrations', 'slack', 'manifest.yml');
  }

  if (envFile) {
    if (!fs.existsSync(envFile)) {
      console.error(`Env file '${envFile}' not found`);
      process.exit(2);
    }
    dotenv.config({ path: path.resolve(envFile) });
  }

  if (!fs.existsSync(TEMPLATE)) {
    console.error(`Template not found: ${TEMPLATE}`);
    process.exit(2);
  }

  // If a .env.slack file exists next to the template, load it so placeholders
  // are populated automatically when the template moved.
  const TEMPLATE_DIR = path.dirname(TEMPLATE);
  const LOCAL_ENV = path.join(TEMPLATE_DIR, '.env.slack');
  if (fs.existsSync(LOCAL_ENV)) {
    dotenv.config({ path: LOCAL_ENV });
  }

  const APP_NAME = process.env.APP_NAME || 'Triage Tracker';
  const REDIRECT_URL = process.env.REDIRECT_URL || 'https://example.com/api/integrations/slack/callback';
  const EVENTS_URL = process.env.EVENTS_URL || 'https://example.com/slack/events';
  const INTERACTIVITY_URL = process.env.INTERACTIVITY_URL || 'https://example.com/slack/interactive';

  let content = fs.readFileSync(TEMPLATE, 'utf8');

  // Simple placeholder replacement for known variables.
  content = content
    .replace(/\$\{APP_NAME\}/g, APP_NAME)
    .replace(/\$\{REDIRECT_URL\}/g, REDIRECT_URL)
    .replace(/\$\{EVENTS_URL\}/g, EVENTS_URL)
    .replace(/\$\{INTERACTIVITY_URL\}/g, INTERACTIVITY_URL);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, content, 'utf8');

  console.log(`Wrote ${OUT}`);
  console.log("To install the app in Slack for testing, upload the manifest in Slack App Manager or use Slack API tooling.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
