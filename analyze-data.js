/**
 * Statistical Analysis of Woodlark Occurrence Data
 * Run with: node analyze-data.js
 */

const fs = require('fs');
const path = require('path');

// Load data
const dataPath = path.join(__dirname, 'data', 'woodlark-occurrences.json');
const summaryPath = path.join(__dirname, 'data', 'summary.json');

// Helper to strip BOM from JSON files
const readJSON = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return JSON.parse(content);
};

const data = readJSON(dataPath);
const summary = readJSON(summaryPath);

console.log('='.repeat(60));
console.log('WOODLARK DATA ANALYSIS');
console.log('='.repeat(60));
console.log(`Total Records: ${data.totalRecords.toLocaleString()}`);
console.log(`Data fetched: ${data.fetchedAt}`);
console.log('');

// 1. Yearly trends
console.log('─'.repeat(60));
console.log('1. YEARLY TRENDS');
console.log('─'.repeat(60));

const yearCounts = {};
data.occurrences.forEach(occ => {
  const year = occ.year;
  if (year) {
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  }
});

const sortedYears = Object.entries(yearCounts)
  .sort((a, b) => a[0] - b[0]);

// Find peak years
const peakYears = Object.entries(yearCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

console.log('\nTop 5 Peak Years:');
peakYears.forEach(([year, count]) => {
  console.log(`  ${year}: ${count.toLocaleString()} sightings`);
});

// Calculate decade trends
const decades = {};
sortedYears.forEach(([year, count]) => {
  const decade = Math.floor(year / 10) * 10;
  if (!decades[decade]) decades[decade] = { total: 0, years: 0 };
  decades[decade].total += count;
  decades[decade].years += 1;
});

console.log('\nDecade Averages:');
Object.entries(decades).sort((a, b) => a[0] - b[0]).forEach(([decade, data]) => {
  const avg = Math.round(data.total / data.years);
  console.log(`  ${decade}s: ${avg.toLocaleString()} avg/year (total: ${data.total.toLocaleString()})`);
});

// Trend analysis
const years2000s = Object.entries(yearCounts).filter(([y]) => y >= 2000 && y < 2010);
const years2010s = Object.entries(yearCounts).filter(([y]) => y >= 2010 && y < 2020);
const years2020s = Object.entries(yearCounts).filter(([y]) => y >= 2020);

const avg2000s = years2000s.reduce((sum, [, c]) => sum + c, 0) / years2000s.length;
const avg2010s = years2010s.reduce((sum, [, c]) => sum + c, 0) / years2010s.length;
const avg2020s = years2020s.reduce((sum, [, c]) => sum + c, 0) / years2020s.length;

console.log('\nRecent Trends:');
console.log(`  2000s average: ${Math.round(avg2000s).toLocaleString()}/year`);
console.log(`  2010s average: ${Math.round(avg2010s).toLocaleString()}/year`);
console.log(`  2020s average: ${Math.round(avg2020s).toLocaleString()}/year`);
console.log(`  2010s vs 2000s: ${avg2010s > avg2000s ? '+' : ''}${((avg2010s - avg2000s) / avg2000s * 100).toFixed(1)}%`);
console.log(`  2020s vs 2010s: ${avg2020s > avg2010s ? '+' : ''}${((avg2020s - avg2010s) / avg2010s * 100).toFixed(1)}%`);

// 2. Seasonal patterns
console.log('\n' + '─'.repeat(60));
console.log('2. SEASONAL PATTERNS');
console.log('─'.repeat(60));

const monthCounts = {};
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

data.occurrences.forEach(occ => {
  const month = parseInt(occ.month);
  if (month >= 1 && month <= 12) {
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }
});

console.log('\nMonthly Distribution:');
for (let m = 1; m <= 12; m++) {
  const count = monthCounts[m] || 0;
  const bar = '█'.repeat(Math.round(count / 500));
  console.log(`  ${monthNames[m-1].padEnd(3)}: ${count.toString().padStart(5)} ${bar}`);
}

// Breeding season analysis (Mar-Jul)
const breedingMonths = [3, 4, 5, 6, 7];
const breedingCount = breedingMonths.reduce((sum, m) => sum + (monthCounts[m] || 0), 0);
const totalMonthly = Object.values(monthCounts).reduce((sum, c) => sum + c, 0);
console.log(`\nBreeding Season (Mar-Jul): ${breedingCount.toLocaleString()} (${(breedingCount/totalMonthly*100).toFixed(1)}% of records)`);

// 3. Geographic distribution
console.log('\n' + '─'.repeat(60));
console.log('3. GEOGRAPHIC DISTRIBUTION');
console.log('─'.repeat(60));

const regionCounts = {};
data.occurrences.forEach(occ => {
  const region = occ.stateProvince || 'Unknown';
  regionCounts[region] = (regionCounts[region] || 0) + 1;
});

const sortedRegions = Object.entries(regionCounts)
  .sort((a, b) => b[1] - a[1]);

console.log('\nTop Regions:');
sortedRegions.slice(0, 10).forEach(([region, count]) => {
  const pct = (count / data.totalRecords * 100).toFixed(1);
  console.log(`  ${region.padEnd(20)}: ${count.toString().padStart(6)} (${pct}%)`);
});

// 4. Hotspot analysis
console.log('\n' + '─'.repeat(60));
console.log('4. GEOGRAPHIC HOTSPOTS');
console.log('─'.repeat(60));

// Grid-based clustering (0.5 degree cells)
const gridCells = {};
data.occurrences.forEach(occ => {
  if (occ.decimalLatitude && occ.decimalLongitude) {
    const latCell = Math.floor(occ.decimalLatitude * 2) / 2;
    const lngCell = Math.floor(occ.decimalLongitude * 2) / 2;
    const key = `${latCell},${lngCell}`;
    if (!gridCells[key]) {
      gridCells[key] = { count: 0, lat: latCell + 0.25, lng: lngCell + 0.25 };
    }
    gridCells[key].count++;
  }
});

const hotspots = Object.entries(gridCells)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 10);

console.log('\nTop 10 Hotspot Cells (0.5° grid):');
hotspots.forEach(([key, data], i) => {
  console.log(`  ${i+1}. Lat ${data.lat.toFixed(2)}, Lng ${data.lng.toFixed(2)}: ${data.count} records`);
});

// 5. Data quality analysis
console.log('\n' + '─'.repeat(60));
console.log('5. DATA QUALITY');
console.log('─'.repeat(60));

let withCoords = 0;
let withYear = 0;
let withMonth = 0;
let withGridRef = 0;

data.occurrences.forEach(occ => {
  if (occ.decimalLatitude && occ.decimalLongitude) withCoords++;
  if (occ.year) withYear++;
  if (occ.month) withMonth++;
  if (occ.gridReference) withGridRef++;
});

console.log(`\nData Completeness:`);
console.log(`  With coordinates: ${withCoords.toLocaleString()} (${(withCoords/data.totalRecords*100).toFixed(1)}%)`);
console.log(`  With year: ${withYear.toLocaleString()} (${(withYear/data.totalRecords*100).toFixed(1)}%)`);
console.log(`  With month: ${withMonth.toLocaleString()} (${(withMonth/data.totalRecords*100).toFixed(1)}%)`);
console.log(`  With grid reference: ${withGridRef.toLocaleString()} (${(withGridRef/data.totalRecords*100).toFixed(1)}%)`);

// Coordinate precision analysis
const precisionBuckets = { high: 0, medium: 0, low: 0 };
data.occurrences.forEach(occ => {
  const uncertainty = occ.coordinateUncertaintyInMeters;
  if (uncertainty) {
    if (uncertainty <= 100) precisionBuckets.high++;
    else if (uncertainty <= 1000) precisionBuckets.medium++;
    else precisionBuckets.low++;
  }
});

console.log(`\nCoordinate Precision:`);
console.log(`  High (<100m): ${precisionBuckets.high.toLocaleString()}`);
console.log(`  Medium (100-1000m): ${precisionBuckets.medium.toLocaleString()}`);
console.log(`  Low (>1000m): ${precisionBuckets.low.toLocaleString()}`);

// 6. Long-term population insights
console.log('\n' + '─'.repeat(60));
console.log('6. POPULATION INSIGHTS');
console.log('─'.repeat(60));

// Calculate year-over-year changes
const yearlyGrowth = [];
const yearsArr = sortedYears.filter(([y]) => y >= 2000);
for (let i = 1; i < yearsArr.length; i++) {
  const prev = yearsArr[i-1][1];
  const curr = yearsArr[i][1];
  const change = ((curr - prev) / prev * 100).toFixed(1);
  yearlyGrowth.push({ year: yearsArr[i][0], change: parseFloat(change) });
}

const avgGrowth = yearlyGrowth.reduce((sum, g) => sum + g.change, 0) / yearlyGrowth.length;
console.log(`\nAverage year-over-year change (2000+): ${avgGrowth > 0 ? '+' : ''}${avgGrowth.toFixed(1)}%`);

// Find best and worst years for growth
const sortedGrowth = [...yearlyGrowth].sort((a, b) => b.change - a.change);
console.log(`\nBest year for growth: ${sortedGrowth[0].year} (${sortedGrowth[0].change > 0 ? '+' : ''}${sortedGrowth[0].change}%)`);
console.log(`Worst year for growth: ${sortedGrowth[sortedGrowth.length-1].year} (${sortedGrowth[sortedGrowth.length-1].change}%)`);

// 7. Key findings summary
console.log('\n' + '='.repeat(60));
console.log('KEY FINDINGS FOR VISUALIZATION');
console.log('='.repeat(60));

const keyFindings = {
  totalRecords: data.totalRecords,
  peakYear: peakYears[0][0],
  peakYearCount: peakYears[0][1],
  topRegion: sortedRegions[0][0],
  topRegionPct: (sortedRegions[0][1] / data.totalRecords * 100).toFixed(1),
  breedingSeasonPct: (breedingCount/totalMonthly*100).toFixed(1),
  trend2020s: avg2020s > avg2010s ? 'increasing' : 'decreasing',
  yearSpan: `${sortedYears[0][0]}-${sortedYears[sortedYears.length-1][0]}`,
  hotspotLat: hotspots[0][1].lat,
  hotspotLng: hotspots[0][1].lng};

console.log('\n1. Peak Year: ' + keyFindings.peakYear + ' with ' + keyFindings.peakYearCount.toLocaleString() + ' sightings');
console.log('2. Top Region: ' + keyFindings.topRegion + ' (' + keyFindings.topRegionPct + '% of all records)');
console.log('3. Breeding Season: ' + keyFindings.breedingSeasonPct + '% of records occur Mar-Jul');
console.log('4. Recent Trend: Sightings are ' + keyFindings.trend2020s + ' in the 2020s');
console.log('5. Data Spans: ' + keyFindings.yearSpan);
console.log('6. Main Hotspot: Near lat ' + keyFindings.hotspotLat.toFixed(1) + ', lng ' + keyFindings.hotspotLng.toFixed(1));

// Save key findings as JSON
fs.writeFileSync(
  path.join(__dirname, 'data', 'insights.json'),
  JSON.stringify(keyFindings, null, 2)
);
console.log('\n✓ Key findings saved to data/insights.json');

console.log('\n' + '='.repeat(60));
