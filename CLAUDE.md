# AI Agent Instructions for NBN Atlas Species Explorer

## Project Overview

This is a **single-page application (SPA)** for visualizing biodiversity data from the NBN Atlas API. Users search for any species and see interactive maps, timelines, seasonal wheels, and data tables.

## Architecture

```
public/
├── index.html          # Single HTML file with all markup
├── css/styles.css      # All CSS (~2400 lines)
└── js/
    ├── app.js          # Main SpeciesExplorer class (~1400 lines)
    └── animations.js   # Flying birds, particles, scroll effects
index.js                # Express server with API proxies
```

## Key Patterns

### SPA Routing
- Hash-based routing: `#/species/{GUID}`
- `showLanding()` / `showVisualization()` toggle views
- Species GUID comes from NBN Atlas (e.g., `NHMSYS0000530739`)

### API Proxying
The Express server proxies all NBN Atlas requests to avoid CORS issues:

| Local Endpoint | Proxies To |
|----------------|------------|
| `/api/species/search` | `species-ws.nbnatlas.org/search` |
| `/api/species/:guid/facets` | `records-ws.nbnatlas.org/occurrences/search` (with facets) |
| `/api/species/:guid/occurrences/:year` | `records-ws.nbnatlas.org/occurrences/search` (paginated) |

### UK & Ireland Filter
All occurrence queries include this filter:
```javascript
const UK_IRELAND_FILTER = '(country:"United Kingdom" OR country:"Ireland" OR country:"UK")';
```

### Large Dataset Handling
For species with >50,000 records, a modal appears letting users choose:
1. Year range selection
2. Record limit (10k/25k/50k/100k from most recent years)
3. Load all

Data is fetched year-by-year, with month-based sub-pagination (up to 60,000 records per year possible).

## CSS Variables

```css
--parchment: #F8F4EB;
--burnt-sienna: #A0522D;
--golden-amber: #DAA520;
--forest-deep: #2D4739;
--sepia-ink: #5D4E37;
--sepia-light: #8B7355;
```

Fonts: Playfair Display (headings), Crimson Pro (body), JetBrains Mono (data)

## Key Classes in app.js

- `SpeciesExplorer` - Main class, initialized on DOMContentLoaded
- `loadSpecies(guid)` - Fetches facets, shows modal if >50k, then `proceedWithLoading()`
- `proceedWithLoading(options)` - Fetches occurrence data year-by-year
- `initMap()` / `initTimeline()` / `initSeasonalWheel()` - Visualization initializers
- `initExplorer()` - Data table with filtering/sorting/pagination

## Common Tasks

### Adding a Featured Species
In `index.html`, add to `.featured-species`:
```html
<button class="featured-btn" data-guid="NHMSYS0000XXXXXX">
  <span class="featured-icon">🦔</span>
  <span class="featured-name">Hedgehog</span>
</button>
```

### Modifying API Queries
Edit `index.js` - all NBN Atlas API construction happens there.

### Styling Changes
All in `public/css/styles.css`. Major sections are commented with `/* ========== */` headers.

## Gotchas

1. **Bird SVGs face left** - When flying left-to-right, apply `scaleX(-1)` to flip
2. **NBN Atlas API has 5000 offset limit** - The API won't return records past startIndex 5000. Server works around this by sub-paginating by month (up to 5000 per year-month combo = 60k/year max)
3. **Year slider resets** - Call `showLanding()` resets slider to "All Years"
4. **Modal events only bound once** - `this.modalEventsBound` flag prevents duplicate listeners
5. **Facet field names** - Use `stateProvince` not `state_province` for NBN Atlas

## Testing

Run `node index.js` and open http://localhost:3000

Test with:
- Small dataset: Woodlark (~31k records)
- Large dataset: Robin (~5.8M records) - triggers modal
- No data species: Search for something obscure

## Git Workflow

Always commit and push together:
```bash
git add -A; git commit -m "message"; git push
```

## Data Licensing

NBN Atlas data is CC BY 4.0. Attribution is included in both footers.
