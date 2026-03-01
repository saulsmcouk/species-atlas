const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Base URLs
const SPECIES_API = 'https://species-ws.nbnatlas.org';
const RECORDS_API = 'https://records-ws.nbnatlas.org';

// Filter to UK and Ireland only
const UK_IRELAND_FILTER = 'country:%22United%20Kingdom%20of%20Great%20Britain%20and%20Northern%20Ireland%22%20OR%20country:%22Ireland%22%20OR%20country:%22Isle%20of%20Man%22';

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve data files (for pre-fetched woodlark data)
app.use('/data', express.static(path.join(__dirname, 'data')));

// ============================================================
// API PROXY ENDPOINTS
// ============================================================

// Search for species by name
app.get('/api/species/search', async (req, res) => {
  try {
    const query = encodeURIComponent(req.query.q || '');
    const pageSize = req.query.pageSize || 10;
    // Use wildcard for partial matching of both common and scientific names
    const url = `${SPECIES_API}/search?q=*${query}*&pageSize=${pageSize}&fq=rank:species`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Simplify the response
    const results = (data.searchResults?.results || []).map(r => ({
      guid: r.guid,
      scientificName: r.scientificName,
      commonName: r.commonNameSingle || r.commonName?.split(',')[0] || '',
      rank: r.rank,
      kingdom: r.kingdom,
      family: r.family,
      occurrenceCount: r.occurrenceCount || 0,
      imageUrl: r.thumbnailUrl || null,
      speciesGroup: r.speciesGroup?.[0] || r.taxonGroup_s || ''
    }));
    
    res.json({
      query: req.query.q,
      totalResults: data.searchResults?.totalRecords || 0,
      results
    });
  } catch (error) {
    console.error('Error searching species:', error);
    res.status(500).json({ error: 'Failed to search species' });
  }
});

// Get species details
app.get('/api/species/:guid', async (req, res) => {
  try {
    const guid = encodeURIComponent(req.params.guid);
    const url = `${SPECIES_API}/species/${guid}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json({
      guid: data.taxonConcept?.guid,
      scientificName: data.taxonConcept?.nameString,
      commonName: data.commonNames?.[0]?.nameString || '',
      kingdom: data.classification?.kingdom,
      family: data.classification?.family,
      imageUrl: data.images?.[0]?.thumbnail || null
    });
  } catch (error) {
    console.error('Error fetching species:', error);
    res.status(500).json({ error: 'Failed to fetch species details' });
  }
});

// Get occurrence facets (years, months, regions) for a species
app.get('/api/species/:guid/facets', async (req, res) => {
  try {
    const guid = encodeURIComponent(req.params.guid);
    const url = `${RECORDS_API}/occurrences/search?q=lsid:${guid}&fq=-occurrence_status%3A%22absent%22&fq=${UK_IRELAND_FILTER}&pageSize=0&facets=year,month,stateProvince&facet=true&flimit=200`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json({
      totalRecords: data.totalRecords,
      facets: data.facetResults || []
    });
  } catch (error) {
    console.error('Error fetching facets:', error);
    res.status(500).json({ error: 'Failed to fetch facets' });
  }
});

// Fetch all occurrences for a species (year-by-year to bypass 5000 limit)
app.get('/api/species/:guid/occurrences', async (req, res) => {
  try {
    const guid = req.params.guid;
    const maxRecords = parseInt(req.query.max) || 50000; // Safety limit
    
    // First get available years from facets
    const facetsUrl = `${RECORDS_API}/occurrences/search?q=lsid:${encodeURIComponent(guid)}&fq=-occurrence_status%3A%22absent%22&fq=${UK_IRELAND_FILTER}&pageSize=0&facets=year&facet=true&flimit=200`;
    const facetsResponse = await fetch(facetsUrl);
    const facetsData = await facetsResponse.json();
    
    const yearFacet = facetsData.facetResults?.find(f => f.fieldName === 'year');
    const years = yearFacet?.fieldResult?.map(r => r.label).sort() || [];
    
    if (years.length === 0) {
      return res.json({
        totalRecords: 0,
        occurrences: []
      });
    }
    
    // Fetch data year by year
    let allOccurrences = [];
    const PAGE_SIZE = 1000;
    
    for (const year of years) {
      if (allOccurrences.length >= maxRecords) break;
      
      let startIndex = 0;
      while (true) {
        const url = `${RECORDS_API}/occurrences/search?q=lsid:${encodeURIComponent(guid)}&fq=-occurrence_status%3A%22absent%22&fq=${UK_IRELAND_FILTER}&fq=year:${year}&pageSize=${PAGE_SIZE}&startIndex=${startIndex}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.occurrences || data.occurrences.length === 0) break;
        
        allOccurrences = allOccurrences.concat(data.occurrences);
        
        if (allOccurrences.length >= maxRecords || data.occurrences.length < PAGE_SIZE) {
          break;
        }
        
        startIndex += PAGE_SIZE;
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
      }
    }
    
    // Trim to max and simplify
    allOccurrences = allOccurrences.slice(0, maxRecords).map(occ => ({
      year: occ.year,
      month: occ.month,
      decimalLatitude: occ.decimalLatitude,
      decimalLongitude: occ.decimalLongitude,
      stateProvince: occ.stateProvince,
      basisOfRecord: occ.basisOfRecord,
      scientificName: occ.scientificName,
      vernacularName: occ.vernacularName
    }));
    
    res.json({
      totalRecords: facetsData.totalRecords,
      fetchedRecords: allOccurrences.length,
      occurrences: allOccurrences
    });
  } catch (error) {
    console.error('Error fetching occurrences:', error);
    res.status(500).json({ error: 'Failed to fetch occurrences' });
  }
});

// Fetch occurrences for a single year (for progress tracking)
app.get('/api/species/:guid/occurrences/:year', async (req, res) => {
  try {
    const guid = req.params.guid;
    const year = req.params.year;
    const maxRecords = req.query.max ? parseInt(req.query.max) : Infinity;
    
    let allOccurrences = [];
    const PAGE_SIZE = 1000;
    let startIndex = 0;
    
    while (allOccurrences.length < maxRecords) {
      const url = `${RECORDS_API}/occurrences/search?q=lsid:${encodeURIComponent(guid)}&fq=-occurrence_status%3A%22absent%22&fq=${UK_IRELAND_FILTER}&fq=year:${year}&pageSize=${PAGE_SIZE}&startIndex=${startIndex}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.occurrences || data.occurrences.length === 0) break;
      
      const occurrences = data.occurrences.map(occ => ({
        year: parseInt(occ.year),
        month: occ.month,
        decimalLatitude: occ.decimalLatitude,
        decimalLongitude: occ.decimalLongitude,
        stateProvince: occ.stateProvince,
        basisOfRecord: occ.basisOfRecord,
        scientificName: occ.scientificName,
        vernacularName: occ.vernacularName
      }));
      
      allOccurrences = allOccurrences.concat(occurrences);
      startIndex += PAGE_SIZE;
      
      if (data.occurrences.length < PAGE_SIZE) break;
    }
    
    res.json({
      year: parseInt(year),
      count: allOccurrences.length,
      occurrences: allOccurrences
    });
  } catch (error) {
    console.error('Error fetching year occurrences:', error);
    res.status(500).json({ error: 'Failed to fetch year occurrences' });
  }
});

// Serve main page (SPA handles routing)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all for SPA routing (Express 5 requires named wildcard)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NBN Atlas Viewer running at http://localhost:${PORT}`);
});
