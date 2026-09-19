/**
 * Chrome UX Report (CrUX) South Korea ranking fetcher.
 *
 * Requires Google Cloud Application Default Credentials and a BigQuery billing
 * project. The public CrUX dataset is queried through the official Node.js
 * BigQuery client.
 *
 * Usage:
 *   node fetch-crux.js
 *   node fetch-crux.js --month 202608
 *   node fetch-crux.js --project my-gcp-project --limit 1000
 */

const fs = require('fs');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET = 'country_kr';
const DATASET_PROJECT = 'chrome-ux-report';
const OUTPUT_FILE = 'crux_top_kr.json';

function parseArgs(argv) {
  const options = {
    month: null,
    project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || null,
    limit: 1000,
    output: OUTPUT_FILE
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--month') options.month = argv[++i];
    else if (arg === '--project') options.project = argv[++i];
    else if (arg === '--limit') options.limit = Number(argv[++i]);
    else if (arg === '--output') options.output = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node fetch-crux.js [--month YYYYMM] [--project PROJECT] [--limit N] [--output FILE]');
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.month && !/^\d{6}$/.test(options.month)) {
    throw new Error('--month must use YYYYMM format');
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error('--limit must be a positive integer');
  }

  return options;
}

async function findLatestMonth(bigquery) {
  const [tables] = await bigquery.dataset(DATASET, { projectId: DATASET_PROJECT }).getTables();
  const months = tables
    .map(table => table.id)
    .filter(tableId => /^\d{6}$/.test(tableId))
    .sort();

  if (months.length === 0) {
    throw new Error(`No YYYYMM tables found in ${DATASET}`);
  }
  return months[months.length - 1];
}

async function queryCrux(bigquery, month, limit) {
  const table = `\`chrome-ux-report.country_kr.${month}\``;
  const query = `
SELECT
  origin AS website,
  MIN(experimental.popularity.rank) AS rank_bucket
FROM ${table}
GROUP BY origin
HAVING rank_bucket <= ${limit}
ORDER BY rank_bucket, website;
`.trim();

  const [rows] = await bigquery.query({
    query,
    location: 'US',
    useLegacySql: false
  });

  return { query, rows };
}

function normalizeRows(rows) {
  const sitesByHostname = new Map();

  for (const row of rows) {
    const rankBucket = Number(row.rank_bucket);
    if (typeof row.website !== 'string' || !Number.isFinite(rankBucket)) continue;

    let origin;
    try {
      origin = new URL(row.website);
    } catch {
      continue;
    }

    if (!['http:', 'https:'].includes(origin.protocol)) continue;

    const website = origin.hostname.toLowerCase().replace(/^www\./, '');
    if (!website) continue;

    const site = {
      website,
      url: origin.origin
    };

    const existing = sitesByHostname.get(website);
    if (
      !existing ||
      rankBucket < existing.rankBucket ||
      (rankBucket === existing.rankBucket && site.url.startsWith('https://') && !existing.site.url.startsWith('https://'))
    ) {
      sitesByHostname.set(website, { site, rankBucket });
    }
  }

  return Array.from(sitesByHostname.values())
    .sort((a, b) => a.rankBucket - b.rankBucket || a.site.website.localeCompare(b.site.website))
    .map(entry => entry.site);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bigquery = new BigQuery(options.project ? { projectId: options.project } : {});
  const month = options.month || await findLatestMonth(bigquery);
  const { query, rows } = await queryCrux(bigquery, month, options.limit);
  const sites = normalizeRows(rows);

  if (sites.length === 0) throw new Error('CrUX query returned no valid rows');

  const outputPath = path.resolve(__dirname, options.output);
  const temporaryPath = `${outputPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(sites, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, outputPath);

  console.log(`CrUX table: country_kr.${month}`);
  console.log(`Rows: ${sites.length}`);
  console.log(`Wrote: ${outputPath}`);
  console.log('Note: rank_bucket is a popularity bucket, not an exact rank.');
  if (process.env.DEBUG === '1') console.log(`Query:\n${query}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { normalizeRows, parseArgs };
