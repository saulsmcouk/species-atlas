// Script to fetch all Woodlark occurrence data from NBN Atlas API
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://records-ws.nbnatlas.org/occurrences/search';
const QUERY = 'q=qid%3A1770719700170&fq=-occurrence_status%3A%22absent%22';
const PAGE_SIZE = 1000;
const DATA_DIR = path.join(__dirname, 'data');

async function fetchPage(startIndex) {
  const url = `${BASE_URL}?${QUERY}&pageSize=${PAGE_SIZE}&startIndex=${startIndex}`;
  console.log(`Fetching page at startIndex=${startIndex}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function fetchAllData() {
  console.log('Starting data fetch from NBN Atlas API...\n');
  
  // First request to get total count
  const firstPage = await fetchPage(0);
  const totalRecords = firstPage.totalRecords;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
  
  console.log(`Total records: ${totalRecords}`);
  console.log(`Total pages to fetch: ${totalPages}\n`);
  
  // Collect all occurrences
  let allOccurrences = [...firstPage.occurrences];
  console.log(`Page 1/${totalPages}: Fetched ${firstPage.occurrences.length} records`);
  
  // Fetch remaining pages
  for (let page = 1; page < totalPages; page++) {
    const startIndex = page * PAGE_SIZE;
    const data = await fetchPage(startIndex);
    allOccurrences = allOccurrences.concat(data.occurrences);
    console.log(`Page ${page + 1}/${totalPages}: Fetched ${data.occurrences.length} records (Total: ${allOccurrences.length})`);
    
    // Small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Create combined dataset
  const dataset = {
    fetchedAt: new Date().toISOString(),
    source: 'NBN Atlas API',
    query: QUERY,
    totalRecords: totalRecords,
    recordCount: allOccurrences.length,
    occurrences: allOccurrences
  };
  
  // Save to data directory
  const outputPath = path.join(DATA_DIR, 'woodlark-occurrences.json');
  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
  console.log(`\n✓ Saved ${allOccurrences.length} records to ${outputPath}`);
  
  // Also save a summary file with facets
  const facetsUrl = `${BASE_URL}?${QUERY}&pageSize=0&facets=species,year,data_resource_uid,month,state_province&facet=true&flimit=100`;
  const facetsResponse = await fetch(facetsUrl);
  const facetsData = await facetsResponse.json();
  
  const summary = {
    fetchedAt: new Date().toISOString(),
    totalRecords: totalRecords,
    facets: facetsData.facetResults
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
