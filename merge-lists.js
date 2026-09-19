/**
 * Merge six JSON source files into one unified list
 *
 * Usage:
 *   node merge-lists.js
 *
 * Reads rank data from six JSON files and writes merged_lists_kr.json.
 */

const fs = require('fs');
const path = require('path');

const FILES = [
  {
    path: 'ahrefs_top_kr.json',
    listName: 'ahrefs',
    domainField: 'website'
  },
  {
    path: 'cloudflare_radar_kr.json',
    listName: 'cloudflare',
    domainField: 'domain'
  },
  {
    path: 'similarweb_top_korea-republic-of.json',
    listName: 'similarweb',
    domainField: 'website'
  },
  {
    path: 'semrush_top_kr.json',
    listName: 'semrush',
    domainField: 'domain_name'
  },
  {
    path: 'crux_top_kr.json',
    listName: 'crux',
    domainField: 'website',
    urlField: 'url',
    rankValue: 1000
  },
  {
    path: 'tranco_list_kr.json',
    listName: 'tranco',
    domainField: 'domain',
    urlField: 'url'
  }
];

const OUTPUT_FILE = 'merged_lists_kr.json';

/**
 * Normalize hostname: strip www. prefix, keep other subdomains
 */
function normalizeWebsite(domain) {
  if (!domain) return '';

  let normalized = domain.toLowerCase().trim();

  if (normalized.startsWith('www.')) {
    normalized = normalized.substring(4);
  }

  return normalized;
}

function readJsonFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error: cannot read ${filePath}:`, error.message);
    return [];
  }
}

function mergeLists() {
  console.log('Merging lists...');

  const websitesMap = new Map();

  const trancoFile = FILES.find(f => f.listName === 'tranco');
  if (trancoFile) {
    console.log(`Reading ${trancoFile.path}...`);
    const trancoData = readJsonFile(trancoFile.path);

    for (const item of trancoData) {
      const domain = item[trancoFile.domainField];
      if (!domain) continue;

      const normalizedWebsite = normalizeWebsite(domain);
      const url = item[trancoFile.urlField] || null;
      const rank = item.rank;

      if (websitesMap.has(normalizedWebsite)) {
        const existing = websitesMap.get(normalizedWebsite);
        const existingTrancoRank = existing.rank[trancoFile.listName];

        if (existingTrancoRank !== undefined && rank < existingTrancoRank) {
          existing.url = url;
          existing.rank[trancoFile.listName] = rank;
        } else if (existingTrancoRank === undefined) {
          existing.url = url;
          existing.rank[trancoFile.listName] = rank;
        }
      } else {
        websitesMap.set(normalizedWebsite, {
          website: normalizedWebsite,
          url: url,
          rank: {
            [trancoFile.listName]: rank
          }
        });
      }
    }

    console.log(`Processed ${trancoData.length} Tranco row(s)`);
  }

  for (const fileConfig of FILES) {
    if (fileConfig.listName === 'tranco') continue;

    console.log(`Reading ${fileConfig.path}...`);
    const data = readJsonFile(fileConfig.path);

    for (const item of data) {
      const domain = item[fileConfig.domainField];
      const rank = fileConfig.rankValue ?? item.rank;
      if (!domain || !Number.isFinite(rank)) continue;

      const normalizedWebsite = normalizeWebsite(domain);
      const url = fileConfig.urlField ? item[fileConfig.urlField] || null : null;

      if (websitesMap.has(normalizedWebsite)) {
        const existing = websitesMap.get(normalizedWebsite);
        existing.rank[fileConfig.listName] = rank;
        if (!existing.url && url) existing.url = url;
      } else {
        websitesMap.set(normalizedWebsite, {
          website: normalizedWebsite,
          url,
          rank: {
            [fileConfig.listName]: rank
          }
        });
      }
    }

    console.log(`Processed ${data.length} ${fileConfig.listName} row(s)`);
  }

  const result = Array.from(websitesMap.values());

  result.sort((a, b) => {
    const getKoreaRankStats = (item) => {
      const exactRanks = [];
      if (item.rank.cloudflare !== undefined) exactRanks.push(item.rank.cloudflare);
      if (item.rank.similarweb !== undefined) exactRanks.push(item.rank.similarweb);
      if (item.rank.ahrefs !== undefined) exactRanks.push(item.rank.ahrefs);
      if (item.rank.semrush !== undefined) exactRanks.push(item.rank.semrush);

      return {
        exactRanks,
        sourceCount: exactRanks.length + (item.rank.crux !== undefined ? 1 : 0)
      };
    };

    const aKorea = getKoreaRankStats(a);
    const bKorea = getKoreaRankStats(b);

    if (aKorea.sourceCount > 0 && bKorea.sourceCount === 0) {
      return -1;
    }
    if (aKorea.sourceCount === 0 && bKorea.sourceCount > 0) {
      return 1;
    }

    if (aKorea.sourceCount > 0 && bKorea.sourceCount > 0) {
      if (aKorea.sourceCount !== bKorea.sourceCount) {
        return bKorea.sourceCount - aKorea.sourceCount;
      }

      if (aKorea.exactRanks.length > 0 && bKorea.exactRanks.length === 0) return -1;
      if (aKorea.exactRanks.length === 0 && bKorea.exactRanks.length > 0) return 1;

      if (aKorea.exactRanks.length > 0 && bKorea.exactRanks.length > 0) {
        const aAvg = aKorea.exactRanks.reduce((sum, r) => sum + r, 0) / aKorea.exactRanks.length;
        const bAvg = bKorea.exactRanks.reduce((sum, r) => sum + r, 0) / bKorea.exactRanks.length;
        if (aAvg !== bAvg) return aAvg - bAvg;

        const aMin = Math.min(...aKorea.exactRanks);
        const bMin = Math.min(...bKorea.exactRanks);
        if (aMin !== bMin) return aMin - bMin;
      }
    }

    const aTranco = a.rank.tranco !== undefined ? a.rank.tranco : Infinity;
    const bTranco = b.rank.tranco !== undefined ? b.rank.tranco : Infinity;
    if (aTranco !== bTranco) {
      return aTranco - bTranco;
    }

    return a.website.localeCompare(b.website);
  });

  for (const item of result) {
    if (!item.url) {
      item.url = `https://${item.website}`;
    }
  }

  const outputPath = path.join(__dirname, OUTPUT_FILE);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log(`\nMerge complete.`);
  console.log(`Total sites: ${result.length}`);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

mergeLists();
