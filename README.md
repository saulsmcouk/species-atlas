# The Song of the Woodlark

An interactive data visualization exploring Woodlark (*Lullula arborea*) sightings across Britain, featuring 31,681 occurrence records from the NBN Atlas.

![Woodlark Visualization](https://img.shields.io/badge/Records-31%2C681-green) ![Years](https://img.shields.io/badge/Data%20Span-1905--2024-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Interactive Map** — Explore woodlark sightings across Britain using Leaflet/OpenStreetMap with a year slider to travel through time
- **Timeline Visualization** — See how sighting patterns have changed from 1905 to 2024
- **Seasonal Wheel** — Discover when woodlarks are most commonly spotted throughout the year
- **Key Insights** — Statistical analysis revealing population trends, breeding patterns, and geographic hotspots
- **Data Explorer** — Filter, sort, and export occurrence data to CSV for your own analysis

## Quick Start

```bash
# Install dependencies
npm install

# Fetch latest data from NBN Atlas API
node fetch-all-data.js

# Run statistical analysis
node analyze-data.js

# Start the server
node index.js
```

Open http://localhost:3000 in your browser.

## Project Structure

```
nbn-atlas-viewer/
├── public/
│   ├── index.html          # Main SPA
│   ├── css/
│   │   └── styles.css      # All styling (~1400 lines)
│   └── js/
│       ├── app.js          # Main application logic
│       └── animations.js   # Flying birds & visual effects
├── data/
│   ├── woodlark-occurrences.json  # 31,681 occurrence records
│   ├── summary.json               # Faceted summary data
│   └── insights.json              # Key statistical findings
├── index.js                # Express server
├── fetch-all-data.js       # NBN Atlas API data fetcher
├── analyze-data.js         # Statistical analysis script
└── package.json
```

## Key Findings

| Metric | Value |
|--------|-------|
| Total Records | 31,681 |
| Data Span | 1905–2024 (119 years) |
| Peak Year | 2006 (2,353 sightings) |
| Breeding Season | 62.7% of records (Mar–Jul) |
| 2020s vs 2010s Growth | +27% |
| Top Region | England (99.3%) |

### Main Hotspots
1. **Surrey Heaths** (lat 51.3°, lng -0.8°) — 5,929 records
2. **Suffolk Brecks** (lat 52.3°, lng 0.8°) — 4,462 records  
3. **New Forest** (lat 50.8°, lng -1.8°) — 3,155 records

## Data Source

All occurrence data is sourced from the [NBN Atlas](https://nbnatlas.org/), the UK's largest collection of biodiversity data. The data was fetched using the NBN Atlas API with year-by-year queries to retrieve the complete dataset.

**Query:** Woodlark (*Lullula arborea*) occurrences, excluding "absent" records.

## Design

The visualization uses a naturalist field journal aesthetic with:
- **Typography:** Playfair Display (headings), Crimson Pro (body), JetBrains Mono (data)
- **Palette:** Parchment, burnt sienna, golden amber, forest deep
- **Animations:** Flying SVG woodlarks, floating particles, scroll-triggered reveals

## API

The Express server exposes:
- `GET /` — Main visualization
- `GET /data/woodlark-occurrences.json` — Raw occurrence data
- `GET /data/summary.json` — Faceted summary
- `GET /data/insights.json` — Statistical insights

## Scripts

| Script | Description |
|--------|-------------|
| `node index.js` | Start Express server on port 3000 |
| `node fetch-all-data.js` | Fetch all data from NBN Atlas API (year-by-year to bypass 5000 limit) |
| `node analyze-data.js` | Run statistical analysis and generate insights.json |

## Requirements

- Node.js 18+ (uses native fetch)
- npm

## License

MIT

## Acknowledgments

- Data provided by the [NBN Atlas](https://nbnatlas.org/)
- Map tiles by [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Built with 🤍 for nature
