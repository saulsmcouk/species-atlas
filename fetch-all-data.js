// Script to fetch all Woodlark occurrence data from NBN Atlas API
// Uses year-by-year fetching to bypass the 5000 record limit per query
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://records-ws.nbnatlas.org/occurrences/search';
const BASE_QUERY = 'q=qid%3A1770719700170&fq=-occurrence_status%3A%22absent%22';
const PAGE_SIZE = 1000;
const DATA_DIR = path.join(__dirname, 'data');

async function fetchPage(query, startIndex) {
  const url = `${BASE_URL}?${query}&pageSize=${PAGE_SIZE}&startIndex=${startIndex}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function fetchYearData(year) {
  const query = `${BASE_QUERY}&fq=year%3A${year}`;
  let allOccurrences = [];
  let startIndex = 0;
  
  while (true) {
    const data = await fetchPage(query, startIndex);
    if (data.occurrences.length === 0) break;
    
    allOccurrences = allOccurrences.concat(data.occurrences);
    
    if (allOccurrences.length >= data.totalRecords || data.occurrences.length < PAGE_SIZE) {
      break;
    }
    
    startIndex += PAGE_SIZE;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return allOccurrences;
}

async function fetchAllData() {
  console.log('Starting data fetch from NBN Atlas API (year-by-year)...\n');
  
  // First, get the available years from facets
  const facetsUrl = `${BASE_URL}?${BASE_QUERY}&pageSize=0&facets=year&facet=true&flimit=100`;
  const facetsResponse = await fetch(facetsUrl);
  const facetsData = await facetsResponse.json();
  
  const yearFacet = facetsData.facetResults?.find(f => f.fieldName === 'year');
  const years = yearFacet?.fieldResult?.map(r => r.label).sort() || [];
  
  console.log(`Found ${years.length} years to fetch: ${years[0]} to ${years[years.length - 1]}\n`);
  
  // Fetch data for each year
  let allOccurrences = [];
  for (const year of years) {
    const yearOccurrences = await fetchYearData(year);
    allOccurrences = allOccurrences.concat(yearOccurrences);
    console.log(`Year ${year}: ${yearOccurrences.length} records (Total: ${allOccurrences.length})`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  
  // Create combined dataset
  const dataset = {
    fetchedAt: new Date().toISOString(),
    source: 'NBN Atlas API',
    query: BASE_QUERY,
    totalRecords: allOccurrences.length,
    recordCount: allOccurrences.length,
    occurrences: allOccurrences
  };
  
  // Save to data directory
  const outputPath = path.join(DATA_DIR, 'woodlark-occurrences.json');
  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
  console.log(`\n✓ Saved ${allOccurrences.length} records to ${outputPath}`);
  
  // Also save a summary file with facets
  const summaryFacetsUrl = `${BASE_URL}?${BASE_QUERY}&pageSize=0&facets=species,year,data_resource_uid,month,state_province&facet=true&flimit=100`;
  const summaryResponse = await fetch(summaryFacetsUrl);
  const summaryData = await summaryResponse.json();
  
  const summary = {
    fetchedAt: new Date().toISOString(),
    totalRecords: allOccurrences.length,
    facets: summaryData.facetResults
  };
  
  const summaryPath = path.join(DATA_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Saved summary/facets to ${summaryPath}`);
  
  console.log('\n=== Fetch Complete ===');
}

fetchAllData().catch(err => {
  console.error('Error fetching data:', err);
  process.exit(1);
});
