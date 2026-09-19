# Korea Website Traffic Ranking Fetcher

The source data and scripts in this repository are for South Korea.

A toolkit for fetching South Korea website traffic rankings from multiple sources:

- [Tranco List](https://tranco-list.eu/) — global top 1 million sites
- [Cloudflare Radar](https://radar.cloudflare.com/) — South Korea traffic top 100 (Cloudflare)
- [AhrefsTop](https://ahrefstop.com/websites/korea) — Korea organic search traffic top 100
- [SimilarWeb](https://www.similarweb.com/top-websites/korea-republic-of/) — South Korea website traffic top 50
- [Semrush](https://www.semrush.com/trending-websites/kr/all) — South Korea website traffic top 100
- [Google CrUX](https://developer.chrome.com/docs/crux) — 1,000 popular website origins visited by eligible Chrome users in South Korea

## 📊 Data sources

### Tranco List
[Tranco List](https://tranco-list.eu/) combines Alexa, Cisco Umbrella, Majestic, Chrome User Experience Report, and other sources for more reliable, stable rankings than any single provider.

Citation: Victor Le Pochat, Tom Van Goethem, Samaneh Tajalizadehkhoob, Maciej Korczyński, and Wouter Joosen. 2019. *Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation*. In *Proceedings of the 26th Annual Network and Distributed System Security Symposium (NDSS 2019)*. https://doi.org/10.14722/ndss.2019.23386

- Source data updates daily
- Filter: domains ending in `.kr`

### Cloudflare Radar
[Cloudflare Radar](https://radar.cloudflare.com/) ranks domains by [1.1.1.1](https://1.1.1.1/) DNS query volume. Provides South Korea top 100 with category metadata via the [Cloudflare Radar API](https://developers.cloudflare.com/radar/) [`/radar/ranking/top`](https://developers.cloudflare.com/radar/investigate/domain-ranking-datasets/) endpoint using location `KR`.

- Ranking window: last 24 hours, updates daily (see [Domains ranking](https://developers.cloudflare.com/radar/investigate/domain-ranking-datasets/))
- Requires a Cloudflare API token in `.env` as `CLOUDFLARE_API_TOKEN`

### AhrefsTop
[AhrefsTop](https://ahrefstop.com/websites/korea) ranks sites by estimated organic search traffic. Korea top 100 with category and search traffic; updated monthly.

- Source data updates monthly

### SimilarWeb
[SimilarWeb](https://www.similarweb.com/top-websites/korea-republic-of/) aggregates direct measurement, partner data, and public sources. South Korea top 50 with category and rank change; updated monthly.

- Source data updates monthly

### Semrush
[Semrush](https://www.semrush.com/trending-websites/kr/all) uses clickstream data for real user behavior. South Korea top 100 with estimated total traffic; updated monthly.

- Source data updates monthly

## 🚀 Usage

```bash
npm install
npm run <tranco|cloudflare|ahrefs|similarweb|semrush|crux|merge>
```

### Chrome UX Report

The CrUX fetcher uses the official `@google-cloud/bigquery` Node.js package to
query the public `chrome-ux-report.country_kr` dataset. The package is
installed by `npm install`.

#### No-cost setup with BigQuery Sandbox

For a no-cost setup, use [BigQuery Sandbox](https://cloud.google.com/bigquery/docs/sandbox).
Sandbox can query public datasets without adding a billing account or credit
card. BigQuery's on-demand analysis also has a free allowance of 1 TiB per
month; see the current [BigQuery pricing](https://cloud.google.com/bigquery/pricing).

The first authentication and Sandbox setup are interactive. After that,
fetching and writing the JSON can be automated by this repository.

To enable BigQuery Sandbox:

1. Open the [BigQuery page in Google Cloud Console](https://console.cloud.google.com/bigquery).
2. Sign in with a Google Account, or create one if needed.
3. On the welcome page, select your country, review and accept the Terms of
   Service, and click **Agree and continue**. Email updates are optional.
4. Click **Create project**.
5. Enter a project name. For **Organization**, select your organization or
   **No organization** if the account is not managed by one. If Google asks
   for a location, click **Browse** and select one.
6. Click **Create**. Google returns you to the BigQuery page.
7. Confirm that the BigQuery page displays the Sandbox notice. Billing should
   remain disabled for this project.
8. Open the project selector in the top navigation, select the new project,
   and copy its project ID. The project ID can differ from the display name.

Then run the following commands from this repository, replacing the example
project ID with the copied value:

```bash
export GCLOUD_PROJECT="your-gcp-project-id"
npm install
npm run crux -- --project "$GCLOUD_PROJECT"
```

On success, the fetcher creates `crux_top_kr.json`. Verify that the output is
valid and non-empty:

```bash
node -e "const d=require('./crux_top_kr.json'); if (!Array.isArray(d) || d.length === 0) process.exit(1); console.log({count:d.length, first:d.slice(0,5), last:d.at(-1)})"
```

The script automatically selects the newest `YYYYMM` table and writes
`crux_top_kr.json`. Use `--month YYYYMM` to reproduce an earlier snapshot:

```bash
npm run crux -- --project your-gcp-project-id --month 202608
```

The query and JSON write are automated, but the initial Google login, project
selection, and Sandbox consent remain manual account actions.

CrUX exposes popularity buckets rather than exact ranks, so the output field
is named `rank_bucket` and must not be interpreted as a precise position.

## 📁 Output files

### Chrome UX Report

Produces `crux_top_kr.json` in a format compatible with the other source
lists:

```json
[
  {
    "website": "example.com",
    "url": "https://example.com"
  }
]
```

The source file only records membership in the South Korea CrUX top-1,000
bucket. During merge, these entries receive `rank.crux: 1000` for compatibility
with the existing merged-list schema; this remains a bucket, not an exact rank.

### Tranco List
Produces `tranco_list_kr.json`:

```json
[
  {
    "rank": 123,
    "domain": "example.co.kr",
    "url": "https://example.co.kr"
  },
  ...
]
```

### Cloudflare Radar
Produces `cloudflare_radar_kr.json`:

```json
[
  {
    "rank": 1,
    "domain": "google.com",
    "categories": [
      {
        "id": 145,
        "name": "Search Engines",
        "superCategoryId": 26
      }
    ]
  },
  ...
]
```

### AhrefsTop
Produces `ahrefs_top_kr.json`:

```json
[
  {
    "rank": 1,
    "website": "wikipedia.org",
    "category": "Reference",
    "search_traffic_K": 80400
  },
  ...
]
```

**Note:** `search_traffic_K` is a plain number in thousands (e.g. "80.4M" → 80400).

### SimilarWeb
Produces `similarweb_top_korea-republic-of.json`:

```json
[
  {
    "rank": 1,
    "website": "google.com",
    "category": "Computers Electronics and Technology > Search Engines"
  },
  ...
]
```

### Semrush
Produces `semrush_top_kr.json`:

```json
[
  {
    "rank": 1,
    "domain_name": "google.com",
    "total_traffic": 971810009
  },
  ...
]
```

### Merge
Merges all six source lists into `merged_lists_kr.json`. CrUX is counted as a
source match, but its popularity bucket is excluded from exact-rank averaging.

## 📜 License

This project is dedicated to the public domain under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), to the extent permitted by law.

See [LICENSE](LICENSE) for the dedication and legal-code link. See also [`CITATION.cff`](CITATION.cff) for machine-readable citation metadata.

## 🙏 Acknowledgements

This work was supported by a grant from the [APNIC Foundation](https://apnic.foundation/) ([ROR: 01y4y6h16](https://ror.org/01y4y6h16)), via the Information Society Innovation Fund (ISIF Asia).
