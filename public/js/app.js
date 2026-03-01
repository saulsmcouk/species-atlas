/**
 * NBN Atlas Species Explorer
 * Interactive data visualization for any species from NBN Atlas
 */

class SpeciesExplorer {
  constructor() {
    this.species = null;
    this.data = null;
    this.yearData = {};
    this.monthData = {};
    this.regionData = {};
    this.currentYear = 'all';
    this.map = null;
    this.markersLayer = null;
    this.radiusCircle = null;
    
    // Location filter state
    this.locationFilter = {
      type: 'none', // 'none', 'grid', 'location'
      gridRefs: [],
      location: null, // { lat, lng, name }
      radius: 10 // km
    };
    this.allGridRefs = []; // Populated from data
    
    this.init();
  }
  
  init() {
    this.bindLandingEvents();
    this.initAnimations();
    this.handleRouting();
  }
  
  // =========================================
  // Location Filter Logic
  // =========================================
  
  // Get occurrences filtered by both year and location
  getFilteredOccurrences() {
    let occurrences;
    if (this.currentYear === 'all') {
      occurrences = this.data?.occurrences || [];
    } else {
      occurrences = this.yearData[this.currentYear] || [];
    }
    
    // Apply location filter
    if (this.locationFilter.type === 'grid' && this.locationFilter.gridRefs.length > 0) {
      occurrences = occurrences.filter(occ => {
        if (!occ.gridReference) return false;
        // Match prefix for any selected grid ref
        return this.locationFilter.gridRefs.some(ref => 
          occ.gridReference.toUpperCase().startsWith(ref.toUpperCase())
        );
      });
    } else if (this.locationFilter.type === 'location' && this.locationFilter.location) {
      const { lat, lng } = this.locationFilter.location;
      const radiusKm = this.locationFilter.radius;
      occurrences = occurrences.filter(occ => {
        if (!occ.decimalLatitude || !occ.decimalLongitude) return false;
        const distance = this.haversineDistance(lat, lng, occ.decimalLatitude, occ.decimalLongitude);
        return distance <= radiusKm;
      });
    }
    
    return occurrences;
  }
  
  // Haversine formula for distance between two coordinates (in km)
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // Extract unique grid reference prefixes from data
  extractGridRefs() {
    if (!this.data?.occurrences) return;
    
    const gridRefSet = new Set();
    this.data.occurrences.forEach(occ => {
      if (occ.gridReference) {
        // Get 2-letter prefix + first 1-2 digits for grouping (e.g., "TQ17", "SK0")
        const match = occ.gridReference.match(/^([A-Z]{1,2}\d{1,2})/i);
        if (match) {
          gridRefSet.add(match[1].toUpperCase());
        }
      }
    });
    
    this.allGridRefs = Array.from(gridRefSet).sort();
  }
  
  // Search location using Nominatim (OpenStreetMap)
  async searchLocation(query) {
    if (query.length < 3) return [];
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&format=json&countrycodes=gb,ie&limit=8`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'NBN-Atlas-Species-Explorer/1.0'
          }
        }
      );
      
      if (!response.ok) throw new Error('Nominatim search failed');
      
      const results = await response.json();
      return results.map(r => ({
        name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        type: r.type
      }));
    } catch (error) {
      console.error('Location search error:', error);
      return [];
    }
  }
  
  // Update filter status UI
  updateFilterStatus() {
    const statusEl = document.getElementById('filter-status');
    const countEl = document.getElementById('filter-count');
    
    if (!statusEl || !countEl) return;
    
    if (this.locationFilter.type === 'none') {
      statusEl.classList.add('hidden');
      return;
    }
    
    const filtered = this.getFilteredOccurrences();
    const total = this.currentYear === 'all' 
      ? this.data?.occurrences?.length || 0
      : this.yearData[this.currentYear]?.length || 0;
    
    countEl.textContent = `${filtered.length.toLocaleString()} of ${total.toLocaleString()} records`;
    statusEl.classList.remove('hidden');
  }
  
  // Update radius circle on map
  updateRadiusCircle() {
    if (this.radiusCircle) {
      this.map?.removeLayer(this.radiusCircle);
      this.radiusCircle = null;
    }
    
    if (this.locationFilter.type === 'location' && this.locationFilter.location && this.map) {
      const { lat, lng } = this.locationFilter.location;
      this.radiusCircle = L.circle([lat, lng], {
        radius: this.locationFilter.radius * 1000, // km to meters
        color: '#A0522D',
        fillColor: '#DAA520',
        fillOpacity: 0.15,
        weight: 2
      }).addTo(this.map);
      
      // Pan map to show the circle
      this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [20, 20] });
    }
  }
  
  // Refresh all visualizations with current filter
  refreshAllVisualizations() {
    this.updateMapMarkers();
    this.updateRegionStats();
    this.updateFilterStatus();
    this.initTimeline();
    this.initSeasonalWheel();
    this.populateInsights();
    
    // Update explorer filtered data
    if (this.filteredData) {
      this.applyFilters();
    }
  }
  
  bindLocationFilterEvents() {
    // Filter type tabs
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const filterType = tab.dataset.filter;
        this.locationFilter.type = filterType;
        
        // Show/hide panels
        document.getElementById('grid-filter-panel')?.classList.toggle('hidden', filterType !== 'grid');
        document.getElementById('location-filter-panel')?.classList.toggle('hidden', filterType !== 'location');
        
        // Clear filters when switching to none
        if (filterType === 'none') {
          this.locationFilter.gridRefs = [];
          this.locationFilter.location = null;
          this.updateRadiusCircle();
          this.refreshAllVisualizations();
        }
      });
    });
    
    // Grid reference search
    const gridSearch = document.getElementById('grid-search');
    const gridDropdown = document.getElementById('grid-dropdown');
    
    if (gridSearch && gridDropdown) {
      gridSearch.addEventListener('input', () => {
        const query = gridSearch.value.toUpperCase().trim();
        
        if (query.length === 0) {
          gridDropdown.classList.add('hidden');
          return;
        }
        
        const matches = this.allGridRefs
          .filter(ref => ref.startsWith(query))
          .slice(0, 20);
        
        if (matches.length === 0) {
          gridDropdown.innerHTML = '<div class="filter-dropdown-item" style="color: var(--sepia-light);">No matching grid references</div>';
        } else {
          gridDropdown.innerHTML = matches.map(ref => 
            `<div class="filter-dropdown-item" data-grid="${ref}">${ref}</div>`
          ).join('');
        }
        
        gridDropdown.classList.remove('hidden');
      });
      
      gridDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.filter-dropdown-item');
        if (item && item.dataset.grid) {
          const ref = item.dataset.grid;
          if (!this.locationFilter.gridRefs.includes(ref)) {
            this.locationFilter.gridRefs.push(ref);
            this.renderActiveGridFilters();
            this.refreshAllVisualizations();
          }
          gridSearch.value = '';
          gridDropdown.classList.add('hidden');
        }
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#grid-search') && !e.target.closest('#grid-dropdown')) {
          gridDropdown.classList.add('hidden');
        }
      });
    }
    
    // Location search
    const locationSearch = document.getElementById('location-search');
    const locationDropdown = document.getElementById('location-dropdown');
    let locationTimeout = null;
    
    if (locationSearch && locationDropdown) {
      locationSearch.addEventListener('input', () => {
        clearTimeout(locationTimeout);
        const query = locationSearch.value.trim();
        
        if (query.length < 3) {
          locationDropdown.classList.add('hidden');
          return;
        }
        
        locationTimeout = setTimeout(async () => {
          const results = await this.searchLocation(query);
          
          if (results.length === 0) {
            locationDropdown.innerHTML = '<div class="filter-dropdown-item" style="color: var(--sepia-light);">No locations found</div>';
          } else {
            locationDropdown.innerHTML = results.map((r, i) => 
              `<div class="filter-dropdown-item" data-idx="${i}">
                <div>${r.name.split(',').slice(0, 2).join(', ')}</div>
                <div class="item-secondary">${r.name.split(',').slice(2, 4).join(', ')}</div>
              </div>`
            ).join('');
            
            // Store results for selection
            locationDropdown._results = results;
          }
          
          locationDropdown.classList.remove('hidden');
        }, 300);
      });
      
      locationDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.filter-dropdown-item');
        if (item && item.dataset.idx !== undefined) {
          const result = locationDropdown._results?.[parseInt(item.dataset.idx)];
          if (result) {
            this.locationFilter.location = result;
            this.renderSelectedLocation();
            document.getElementById('radius-control')?.classList.remove('hidden');
            this.updateRadiusCircle();
            this.refreshAllVisualizations();
          }
          locationSearch.value = '';
          locationDropdown.classList.add('hidden');
        }
      });
      
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#location-search') && !e.target.closest('#location-dropdown')) {
          locationDropdown.classList.add('hidden');
        }
      });
    }
    
    // Radius slider
    const radiusSlider = document.getElementById('radius-slider');
    const radiusValue = document.getElementById('radius-value');
    
    if (radiusSlider && radiusValue) {
      radiusSlider.addEventListener('input', () => {
        this.locationFilter.radius = parseInt(radiusSlider.value);
        radiusValue.textContent = radiusSlider.value;
        this.updateRadiusCircle();
        this.refreshAllVisualizations();
      });
    }
    
    // Location clear button
    document.getElementById('selected-location')?.querySelector('.location-clear')?.addEventListener('click', () => {
      this.locationFilter.location = null;
      document.getElementById('selected-location')?.classList.add('hidden');
      document.getElementById('radius-control')?.classList.add('hidden');
      this.updateRadiusCircle();
      this.refreshAllVisualizations();
    });
    
    // Clear all filter button
    document.getElementById('clear-location-filter')?.addEventListener('click', () => {
      // Reset to "none" tab
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.filter-tab[data-filter="none"]')?.classList.add('active');
      
      this.locationFilter.type = 'none';
      this.locationFilter.gridRefs = [];
      this.locationFilter.location = null;
      
      document.getElementById('grid-filter-panel')?.classList.add('hidden');
      document.getElementById('location-filter-panel')?.classList.add('hidden');
      document.getElementById('selected-location')?.classList.add('hidden');
      document.getElementById('radius-control')?.classList.add('hidden');
      document.getElementById('active-grid-filters').innerHTML = '';
      
      this.updateRadiusCircle();
      this.refreshAllVisualizations();
    });
  }
  
  renderActiveGridFilters() {
    const container = document.getElementById('active-grid-filters');
    if (!container) return;
    
    container.innerHTML = this.locationFilter.gridRefs.map(ref => 
      `<span class="active-filter-tag">
        ${ref}
        <button data-ref="${ref}" title="Remove">&times;</button>
      </span>`
    ).join('');
    
    container.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const ref = btn.dataset.ref;
        this.locationFilter.gridRefs = this.locationFilter.gridRefs.filter(r => r !== ref);
        this.renderActiveGridFilters();
        this.refreshAllVisualizations();
      });
    });
  }
  
  renderSelectedLocation() {
    const container = document.getElementById('selected-location');
    const nameEl = container?.querySelector('.location-name');
    
    if (container && nameEl && this.locationFilter.location) {
      nameEl.textContent = this.locationFilter.location.name.split(',').slice(0, 2).join(', ');
      container.classList.remove('hidden');
    }
  }
  
  // =========================================
  // SPA Routing
  // =========================================
  handleRouting() {
    const hash = window.location.hash;
    
    if (hash.startsWith('#/species/')) {
      const guid = hash.replace('#/species/', '');
      this.loadSpecies(guid);
    } else {
      this.showLanding();
    }
    
    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash;
      if (newHash.startsWith('#/species/')) {
        const guid = newHash.replace('#/species/', '');
        this.loadSpecies(guid);
      } else {
        this.showLanding();
      }
    });
  }
  
  showLanding() {
    document.getElementById('landing-view').classList.remove('hidden');
    document.getElementById('visualization-view').classList.add('hidden');
    document.getElementById('loading-overlay').classList.add('hidden');
    document.title = 'NBN Atlas Species Explorer';
    
    // Reset year slider
    const yearSlider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-display');
    if (yearSlider) {
      yearSlider.value = yearSlider.max;
    }
    if (yearDisplay) {
      yearDisplay.textContent = 'All Years';
    }
    this.currentYear = 'all';
  }
  
  showVisualization() {
    document.getElementById('landing-view').classList.add('hidden');
    document.getElementById('visualization-view').classList.remove('hidden');
  }
  
  // =========================================
  // Landing Page Events
  // =========================================
  bindLandingEvents() {
    const searchInput = document.getElementById('species-search');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const backLink = document.getElementById('back-to-search');
    
    let searchTimeout = null;
    
    // Search input with debounce
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        
        if (query.length < 2) {
          searchResults.classList.add('hidden');
          return;
        }
        
        searchTimeout = setTimeout(() => {
          this.searchSpecies(query);
        }, 300);
      });
      
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(searchTimeout);
          const query = searchInput.value.trim();
          if (query.length >= 2) {
            this.searchSpecies(query);
          }
        }
      });
    }
    
    // Search button
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const query = searchInput?.value.trim();
        if (query && query.length >= 2) {
          this.searchSpecies(query);
        }
      });
    }
    
    // Featured species buttons
    document.querySelectorAll('.featured-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const guid = btn.dataset.guid;
        window.location.hash = `/species/${guid}`;
      });
    });
    
    // Back to search link
    if (backLink) {
      backLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '';
        this.showLanding();
      });
    }
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        searchResults?.classList.add('hidden');
      }
    });
  }
  
  async searchSpecies(query) {
    const searchResults = document.getElementById('search-results');
    
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
    
    try {
      const response = await fetch(`/api/species/search?q=${encodeURIComponent(query)}&pageSize=10`);
      const data = await response.json();
      
      if (data.results.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">No species found</div>';
        return;
      }
      
      searchResults.innerHTML = data.results.map(species => {
        const icon = this.getSpeciesIcon(species.speciesGroup);
        return `
          <div class="search-result-item" data-guid="${species.guid}">
            ${species.imageUrl 
              ? `<img src="${species.imageUrl}" alt="" class="result-image">` 
              : `<div class="result-image-placeholder">${icon}</div>`
            }
            <div class="result-info">
              <div class="result-common">${species.commonName || species.scientificName}</div>
              <div class="result-scientific">${species.scientificName}</div>
            </div>
            <div class="result-count">${species.occurrenceCount.toLocaleString()} records</div>
          </div>
        `;
      }).join('');
      
      // Bind click events to results
      searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const guid = item.dataset.guid;
          window.location.hash = `/species/${guid}`;
          searchResults.classList.add('hidden');
        });
      });
      
    } catch (error) {
      console.error('Search error:', error);
      searchResults.innerHTML = '<div class="search-no-results">Search failed. Please try again.</div>';
    }
  }
  
  getSpeciesIcon(group) {
    const icons = {
      'Birds': '🐦',
      'bird': '🐦',
      'Mammals': '🦊',
      'mammal': '🦊',
      'Plants': '🌿',
      'flowering plant': '🌸',
      'Insects': '🦋',
      'insect': '🦋',
      'Fish': '🐟',
      'Amphibians': '🐸',
      'Reptiles': '🦎',
      'Fungi': '🍄',
      'fungus': '🍄'
    };
    return icons[group] || '🔬';
  }
  
  // =========================================
  // Load Species Data
  // =========================================
  async loadSpecies(guid) {
    this.showLoading('Loading species information...');
    this.loadStartTime = Date.now();
    this.loadingTimerInterval = null;
    this.currentGuid = guid;
    
    try {
      // Get facets first (fast) to know what we're dealing with
      this.updateLoadingText('Fetching occurrence statistics...');
      const facetsRes = await fetch(`/api/species/${encodeURIComponent(guid)}/facets`);
      const facets = await facetsRes.json();
      
      // Get species info from search
      const searchRes = await fetch(`/api/species/search?q=${encodeURIComponent(guid)}&pageSize=1`);
      const searchData = await searchRes.json();
      
      this.species = searchData.results[0] || {
        guid,
        scientificName: 'Unknown Species',
        commonName: ''
      };
      this.species.totalRecords = facets.totalRecords;
      this.facetsData = facets;
      
      // Get year breakdown from facets
      const yearFacet = facets.facets?.find(f => f.fieldName === 'year');
      this.yearFacetData = [];
      
      if (yearFacet?.fieldResult) {
        this.yearFacetData = yearFacet.fieldResult
          .map(y => ({ year: parseInt(y.label), count: y.count }))
          .filter(y => !isNaN(y.year))
          .sort((a, b) => b.year - a.year);
      }
      
      // Check if we need to show the warning modal
      const LARGE_DATASET_THRESHOLD = 50000;
      
      if (facets.totalRecords > LARGE_DATASET_THRESHOLD) {
        // Hide loading, show warning modal
        this.hideLoading();
        this.showDatasetWarning(facets.totalRecords, this.yearFacetData);
      } else {
        // Proceed with loading all records
        await this.proceedWithLoading({ mode: 'all' });
      }
      
    } catch (error) {
      console.error('Failed to load species:', error);
      this.stopLoadingTimer();
      this.showError(error.message);
    }
  }
  
  showDatasetWarning(totalRecords, yearData) {
    const modal = document.getElementById('dataset-warning-modal');
    const totalEl = document.getElementById('warning-total-records');
    const yearFromSelect = document.getElementById('year-from');
    const yearToSelect = document.getElementById('year-to');
    const loadAllWarning = document.getElementById('load-all-warning');
    
    // Update total records display
    if (totalEl) totalEl.textContent = totalRecords.toLocaleString();
    
    // Calculate estimated load time
    const estimatedMinutes = Math.ceil(totalRecords / 10000);
    if (loadAllWarning) {
      loadAllWarning.textContent = `This may take ${estimatedMinutes}+ minutes`;
    }
    
    // Populate year dropdowns
    const years = yearData.map(y => y.year).sort((a, b) => a - b);
    const minYear = years[0] || 2000;
    const maxYear = years[years.length - 1] || new Date().getFullYear();
    
    yearFromSelect.innerHTML = '';
    yearToSelect.innerHTML = '';
    
    for (let y = maxYear; y >= minYear; y--) {
      yearFromSelect.innerHTML += `<option value="${y}">${y}</option>`;
      yearToSelect.innerHTML += `<option value="${y}">${y}</option>`;
    }
    
    // Default to last 5 years
    const defaultFrom = Math.max(minYear, maxYear - 4);
    yearFromSelect.value = defaultFrom;
    yearToSelect.value = maxYear;
    
    this.updateYearEstimate();
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Bind events if not already bound
    if (!this.modalEventsBound) {
      this.bindModalEvents();
      this.modalEventsBound = true;
    }
  }
  
  updateYearEstimate() {
    const yearFromSelect = document.getElementById('year-from');
    const yearToSelect = document.getElementById('year-to');
    const estimateEl = document.getElementById('year-estimate');
    
    const fromYear = parseInt(yearFromSelect.value);
    const toYear = parseInt(yearToSelect.value);
    
    let estimate = 0;
    for (const y of this.yearFacetData) {
      if (y.year >= fromYear && y.year <= toYear) {
        estimate += y.count;
      }
    }
    
    if (estimateEl) {
      estimateEl.textContent = `~${estimate.toLocaleString()} records`;
    }
  }
  
  bindModalEvents() {
    const modal = document.getElementById('dataset-warning-modal');
    const cancelBtn = document.getElementById('warning-cancel');
    const proceedBtn = document.getElementById('warning-proceed');
    const yearRangeRadio = document.getElementById('radio-year-range');
    const recordLimitRadio = document.getElementById('radio-record-limit');
    const loadAllRadio = document.getElementById('radio-load-all');
    const yearRangeControls = document.getElementById('year-range-controls');
    const recordLimitControls = document.getElementById('record-limit-controls');
    const yearFromSelect = document.getElementById('year-from');
    const yearToSelect = document.getElementById('year-to');
    
    // Radio button changes
    const updateControlsVisibility = () => {
      yearRangeControls.classList.toggle('hidden', !yearRangeRadio.checked);
      recordLimitControls.classList.toggle('hidden', !recordLimitRadio.checked);
    };
    
    yearRangeRadio.addEventListener('change', updateControlsVisibility);
    recordLimitRadio.addEventListener('change', updateControlsVisibility);
    loadAllRadio.addEventListener('change', updateControlsVisibility);
    
    // Year selects
    yearFromSelect.addEventListener('change', () => this.updateYearEstimate());
    yearToSelect.addEventListener('change', () => this.updateYearEstimate());
    
    // Record limit buttons
    document.querySelectorAll('.record-limit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.record-limit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      window.location.hash = '';
    });
    
    // Proceed button
    proceedBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      
      let options = {};
      
      if (yearRangeRadio.checked) {
        options = {
          mode: 'year-range',
          fromYear: parseInt(yearFromSelect.value),
          toYear: parseInt(yearToSelect.value)
        };
      } else if (recordLimitRadio.checked) {
        const activeBtn = document.querySelector('.record-limit-btn.active');
        options = {
          mode: 'record-limit',
          limit: parseInt(activeBtn?.dataset.limit || 25000)
        };
      } else {
        options = { mode: 'all' };
      }
      
      this.showLoading('Loading occurrence data...');
      this.proceedWithLoading(options);
    });
  }
  
  async proceedWithLoading(options) {
    try {
      // Update hero with species info
      this.updateHero();
      this.showVisualization();
      
      const yearCounts = {};
      let totalToFetch = 0;
      
      if (options.mode === 'year-range') {
        // Filter to selected year range
        for (const y of this.yearFacetData) {
          if (y.year >= options.fromYear && y.year <= options.toYear) {
            yearCounts[y.year] = y.count;
            totalToFetch += y.count;
          }
        }
      } else if (options.mode === 'record-limit') {
        // Load most recent years up to limit
        const sortedYears = [...this.yearFacetData].sort((a, b) => b.year - a.year);
        for (const y of sortedYears) {
          if (totalToFetch >= options.limit) break;
          const toFetch = Math.min(y.count, options.limit - totalToFetch);
          yearCounts[y.year] = toFetch;
          totalToFetch += toFetch;
        }
      } else {
        // Load all (no limit)
        for (const y of this.yearFacetData) {
          yearCounts[y.year] = y.count;
          totalToFetch += y.count;
        }
      }
      
      const years = Object.keys(yearCounts).map(Number).sort((a, b) => b.year - a.year);
      
      if (years.length === 0) {
        this.data = { totalRecords: 0, occurrences: [] };
        this.hideLoading();
        return;
      }
      
      // Show progress bar
      this.showProgressBar(0, totalToFetch);
      this.startLoadingTimer();
      
      this.updateLoadingText(`Loading ${totalToFetch.toLocaleString()} occurrence records...`, 
        `Fetching data from ${years.length} years`);
      
      // Fetch year by year with streaming progress
      let allOccurrences = [];
      let fetchedCount = 0;
      
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const maxForYear = yearCounts[year];
        
        try {
          // Use SSE for real-time progress (drills down: month -> day if needed)
          const yearOccurrences = await this.fetchYearWithStreaming(year, maxForYear, (progress) => {
            // Update progress with current drill level
            const currentYearRecords = progress.records;
            this.updateProgress(fetchedCount + currentYearRecords, totalToFetch);
            
            // Show drill level (month or day with month context)
            let levelText = '';
            if (progress.level === 'month') {
              levelText = `month ${progress.value}`;
            } else if (progress.level === 'day') {
              levelText = `month ${progress.month} - day ${progress.value}`;
            }
            
            this.updateLoadingText(
              `Loading occurrence records...`, 
              `Year ${year}${levelText ? ' - ' + levelText : ''} (year ${i + 1}/${years.length})`
            );
          });
          
          allOccurrences = allOccurrences.concat(yearOccurrences);
          fetchedCount += yearOccurrences.length;
          
          // Final update for year
          this.updateProgress(fetchedCount, totalToFetch);
          this.updateLoadingText(
            `Loading occurrence records...`, 
            `Year ${year} complete (${i + 1}/${years.length})`
          );
        } catch (err) {
          console.warn(`Failed to fetch year ${year}:`, err);
        }
      }
      
      this.stopLoadingTimer();
      
      this.data = {
        totalRecords: this.facetsData.totalRecords,
        occurrences: allOccurrences
      };
      
      // Process data
      this.processData();
      this.processFacets(this.facetsData.facets);
      
      // Hide loading and initialize visualizations
      this.hideLoading();
      this.initMap();
      this.initTimeline();
      this.initSeasonalWheel();
      this.populateInsights();
      this.initExplorer();
      this.initScrollAnimations();
      
      // Animate counter
      this.animateHeroCounter();
      
      // Update page title
      document.title = `${this.species.commonName || this.species.scientificName} | NBN Atlas Explorer`;
      
    } catch (error) {
      console.error('Failed to load data:', error);
      this.stopLoadingTimer();
      this.showError(error.message);
    }
  }
  
  updateHero() {
    const scientificEl = document.getElementById('species-scientific');
    const commonEl = document.getElementById('species-common');
    const subtitleEl = document.getElementById('species-subtitle');
    
    if (scientificEl) scientificEl.textContent = this.species.scientificName;
    if (commonEl) commonEl.textContent = this.species.commonName || this.species.scientificName;
    if (subtitleEl) subtitleEl.textContent = `Exploring ${this.species.totalRecords?.toLocaleString() || 'occurrence'} records across Britain`;
  }
  
  processData() {
    this.yearData = {};
    this.monthData = {};
    this.regionData = {};
    
    this.data.occurrences.forEach(occ => {
      const year = occ.year;
      if (year) {
        if (!this.yearData[year]) this.yearData[year] = [];
        this.yearData[year].push(occ);
      }
      
      const month = occ.month;
      if (month) {
        const monthNum = parseInt(month);
        if (!this.monthData[monthNum]) this.monthData[monthNum] = [];
        this.monthData[monthNum].push(occ);
      }
      
      const region = occ.stateProvince || 'Unknown';
      if (!this.regionData[region]) this.regionData[region] = [];
      this.regionData[region].push(occ);
    });
    
    this.years = Object.keys(this.yearData).map(Number).sort((a, b) => a - b);
    
    // Extract grid references for filter
    this.extractGridRefs();
    
    // Bind location filter events once
    if (!this.locationFilterBound) {
      this.bindLocationFilterEvents();
      this.locationFilterBound = true;
    }
  }
  
  // Fetch year data with SSE streaming for recursive progress (month -> day if needed)
  fetchYearWithStreaming(year, maxRecords, onProgress) {
    return new Promise((resolve, reject) => {
      const url = `/api/species/${encodeURIComponent(this.currentGuid)}/occurrences/${year}?max=${maxRecords}&stream=true`;
      
      const eventSource = new EventSource(url);
      let occurrences = [];
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            // Report progress with drill level (month/day)
            onProgress({ level: data.level, month: data.month, value: data.value, records: data.records });
          } else if (data.type === 'complete') {
            // All done - close connection and resolve
            eventSource.close();
            occurrences = data.occurrences || [];
            resolve(occurrences);
          } else if (data.type === 'error') {
            eventSource.close();
            reject(new Error(data.message));
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      
      eventSource.onerror = (err) => {
        eventSource.close();
        // Fallback to regular fetch if SSE fails
        console.warn('SSE failed, falling back to regular fetch');
        fetch(`/api/species/${encodeURIComponent(this.currentGuid)}/occurrences/${year}?max=${maxRecords}`)
          .then(res => res.json())
          .then(data => resolve(data.occurrences || []))
          .catch(reject);
      };
    });
  }
  
  processFacets(facets) {
    this.facets = {};
    if (!facets) return;
    
    facets.forEach(facet => {
      this.facets[facet.fieldName] = facet.fieldResult || [];
    });
  }
  
  // =========================================
  // UI Helpers
  // =========================================
  showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    const progressContainer = document.getElementById('loading-progress-container');
    
    if (textEl) textEl.textContent = text;
    if (overlay) overlay.classList.remove('hidden');
    if (progressContainer) progressContainer.classList.remove('visible');
    
    // Reset progress bar
    this.updateProgress(0, 0);
  }
  
  updateLoadingText(text, subtext = '') {
    const textEl = document.getElementById('loading-text');
    const subtextEl = document.getElementById('loading-subtext');
    
    if (textEl) textEl.textContent = text;
    if (subtextEl) subtextEl.textContent = subtext;
  }
  
  showProgressBar(current, total) {
    const progressContainer = document.getElementById('loading-progress-container');
    if (progressContainer) {
      progressContainer.classList.add('visible');
    }
    this.updateProgress(current, total);
  }
  
  updateProgress(current, total) {
    const progressFill = document.getElementById('loading-progress-fill');
    const recordsEl = document.getElementById('loading-records');
    
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    // Store for time estimation
    this.progressCurrent = current;
    this.progressTotal = total;
    
    if (progressFill) {
      progressFill.style.width = `${Math.min(percentage, 100)}%`;
    }
    
    if (recordsEl) {
      recordsEl.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} records`;
    }
  }
  
  startLoadingTimer() {
    this.loadStartTime = Date.now();
    this.progressCurrent = 0;
    this.progressTotal = 0;
    const timeEl = document.getElementById('loading-time');
    
    this.loadingTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.loadStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const elapsedStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Calculate estimated time remaining
      let remainingStr = '';
      if (this.progressCurrent > 0 && this.progressTotal > 0 && this.progressCurrent < this.progressTotal) {
        const recordsPerSecond = this.progressCurrent / elapsed;
        const recordsRemaining = this.progressTotal - this.progressCurrent;
        const secondsRemaining = Math.ceil(recordsRemaining / recordsPerSecond);
        const remMinutes = Math.floor(secondsRemaining / 60);
        const remSeconds = secondsRemaining % 60;
        remainingStr = ` (~${remMinutes}:${remSeconds.toString().padStart(2, '0')} remaining)`;
      }
      
      if (timeEl) {
        timeEl.textContent = elapsedStr + remainingStr;
      }
    }, 1000);
  }
  
  stopLoadingTimer() {
    if (this.loadingTimerInterval) {
      clearInterval(this.loadingTimerInterval);
      this.loadingTimerInterval = null;
    }
  }
  
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    const progressContainer = document.getElementById('loading-progress-container');
    
    this.stopLoadingTimer();
    
    if (overlay) {
      setTimeout(() => overlay.classList.add('hidden'), 300);
    }
    if (progressContainer) {
      progressContainer.classList.remove('visible');
    }
  }
  
  showError(message) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div class="error-message">
          <p>Failed to load data: ${message}</p>
          <a href="#" style="color: var(--burnt-sienna);">Return to search</a>
        </div>
      `;
    }
  }
  
  initAnimations() {
    const birdsContainer = document.getElementById('flying-birds');
    if (birdsContainer && typeof FlyingBirds !== 'undefined') {
      this.flyingBirds = new FlyingBirds(birdsContainer);
    }
    
    const particlesContainer = document.getElementById('particles');
    if (particlesContainer && typeof FloatingParticles !== 'undefined') {
      this.particles = new FloatingParticles(particlesContainer, 25);
    }
  }
  
  animateHeroCounter() {
    const counterEl = document.getElementById('total-counter');
    if (counterEl && typeof animateCounter !== 'undefined') {
      animateCounter(counterEl, this.data.totalRecords, 2500);
    }
  }
  
  initScrollAnimations() {
    if (typeof ScrollAnimations !== 'undefined') {
      new ScrollAnimations();
    }
  }
  
  // =========================================
  // Interactive UK Map with Leaflet
  // =========================================
  initMap() {
    const mapContainer = document.getElementById('uk-map');
    if (!mapContainer) return;
    
    // Clean up existing map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    
    this.map = L.map('uk-map', {
      center: [54.5, -2.5],
      zoom: 5,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: true,
      scrollWheelZoom: true
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      opacity: 0.85
    }).addTo(this.map);
    
    this.markersLayer = L.layerGroup().addTo(this.map);
    
    // Year slider
    const yearSlider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-display');
    
    if (yearSlider && this.years.length > 0) {
      yearSlider.min = 0;
      yearSlider.max = this.years.length;
      yearSlider.value = this.years.length;
      
      yearSlider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value);
        if (idx >= this.years.length) {
          this.currentYear = 'all';
          yearDisplay.textContent = 'All Years';
        } else {
          this.currentYear = this.years[idx];
          yearDisplay.textContent = this.currentYear;
        }
        this.updateMapMarkers();
        this.updateRegionStats();
      });
    }
    
    this.updateMapMarkers();
    this.updateRegionStats();
  }
  
  updateMapMarkers() {
    if (!this.markersLayer) return;
    
    this.markersLayer.clearLayers();
    
    // Use filtered occurrences
    const occurrences = this.getFilteredOccurrences();
    
    const icon = L.divIcon({
      className: 'woodlark-marker',
      html: '<div class="marker-dot"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    
    // Sample for performance
    const sampleSize = Math.min(occurrences.length, 3000);
    const step = Math.max(1, Math.floor(occurrences.length / sampleSize));
    
    for (let i = 0; i < occurrences.length; i += step) {
      const occ = occurrences[i];
      if (occ.decimalLatitude && occ.decimalLongitude) {
        L.marker([occ.decimalLatitude, occ.decimalLongitude], { icon })
          .addTo(this.markersLayer);
      }
    }
  }
  
  updateRegionStats() {
    const statsContainer = document.getElementById('region-stats');
    if (!statsContainer) return;
    
    // Use filtered occurrences
    const occurrences = this.getFilteredOccurrences();
    
    const regionCounts = {};
    occurrences.forEach(occ => {
      const region = occ.stateProvince || 'Unknown';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });
    
    const sortedRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    
    const maxCount = sortedRegions[0]?.[1] || 1;
    
    statsContainer.innerHTML = sortedRegions.map(([region, count]) => `
      <div class="region-stat">
        <div class="region-name">${region}</div>
        <div class="region-bar-container">
          <div class="region-bar" style="width: ${(count / maxCount) * 100}%"></div>
        </div>
        <div class="region-count">${count.toLocaleString()}</div>
      </div>
    `).join('');
  }
  
  // =========================================
  // Timeline
  // =========================================
  initTimeline() {
    const trackContainer = document.getElementById('timeline-track');
    const decadesContainer = document.getElementById('timeline-decades');
    
    if (!trackContainer || this.years.length === 0) return;
    
    // Compute year counts from filtered data when location filter is active
    const filteredOccurrences = this.getFilteredOccurrences();
    const yearCountMap = {};
    filteredOccurrences.forEach(occ => {
      if (occ.year) {
        yearCountMap[occ.year] = (yearCountMap[occ.year] || 0) + 1;
      }
    });
    
    const yearCounts = this.years.map(year => ({
      year,
      count: yearCountMap[year] || 0
    }));
    
    const maxCount = Math.max(...yearCounts.map(y => y.count), 1);
    
    trackContainer.innerHTML = this.years.map(year => {
      const count = yearCountMap[year] || 0;
      const height = (count / maxCount) * 100;
      return `
        <div class="timeline-bar" 
             data-year="${year}" 
             data-count="${count}"
             style="height: ${Math.max(height, 2)}%">
        </div>
      `;
    }).join('');
    
    // Decade labels
    const decades = [...new Set(this.years.map(y => Math.floor(y / 10) * 10))];
    if (decadesContainer) {
      decadesContainer.innerHTML = decades.map(decade => `
        <span class="decade-label">${decade}s</span>
      `).join('');
    }
    
    // Tooltips
    const tooltip = document.getElementById('timeline-tooltip');
    trackContainer.querySelectorAll('.timeline-bar').forEach(bar => {
      bar.addEventListener('mouseenter', (e) => {
        const year = bar.dataset.year;
        const count = bar.dataset.count;
        tooltip.textContent = `${year}: ${parseInt(count).toLocaleString()} sightings`;
        tooltip.style.opacity = '1';
        
        const rect = bar.getBoundingClientRect();
        const containerRect = trackContainer.getBoundingClientRect();
        tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
      });
      
      bar.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  }
  
  // =========================================
  // Seasonal Wheel
  // =========================================
  initSeasonalWheel() {
    const wheelContainer = document.getElementById('seasonal-wheel');
    if (!wheelContainer) return;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Compute month counts from filtered data
    const filteredOccurrences = this.getFilteredOccurrences();
    const monthCountMap = {};
    filteredOccurrences.forEach(occ => {
      if (occ.month) {
        const monthNum = parseInt(occ.month);
        monthCountMap[monthNum] = (monthCountMap[monthNum] || 0) + 1;
      }
    });
    
    const monthCounts = months.map((_, i) => monthCountMap[i + 1] || 0);
    const maxCount = Math.max(...monthCounts, 1);
    
    const size = 400;
    const center = size / 2;
    const outerRadius = 180;
    const innerRadius = 60;
    
    let svg = `<svg class="seasonal-wheel" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
    
    months.forEach((month, i) => {
      const count = monthCounts[i];
      const ratio = count / maxCount;
      const segmentRadius = innerRadius + (outerRadius - innerRadius) * ratio;
      
      const startAngle = (i * 30 - 90) * Math.PI / 180;
      const endAngle = ((i + 1) * 30 - 90) * Math.PI / 180;
      
      const x1 = center + innerRadius * Math.cos(startAngle);
      const y1 = center + innerRadius * Math.sin(startAngle);
      const x2 = center + segmentRadius * Math.cos(startAngle);
      const y2 = center + segmentRadius * Math.sin(startAngle);
      const x3 = center + segmentRadius * Math.cos(endAngle);
      const y3 = center + segmentRadius * Math.sin(endAngle);
      const x4 = center + innerRadius * Math.cos(endAngle);
      const y4 = center + innerRadius * Math.sin(endAngle);
      
      const hue = 30 + ratio * 20;
      const saturation = 50 + ratio * 30;
      const lightness = 70 - ratio * 25;
      
      svg += `
        <path class="wheel-segment" 
              d="M ${x1} ${y1} L ${x2} ${y2} A ${segmentRadius} ${segmentRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1} Z"
              fill="hsl(${hue}, ${saturation}%, ${lightness}%)"
              data-month="${month}" 
              data-count="${count}">
        </path>
      `;
      
      const labelAngle = ((i + 0.5) * 30 - 90) * Math.PI / 180;
      const labelRadius = outerRadius + 25;
      const labelX = center + labelRadius * Math.cos(labelAngle);
      const labelY = center + labelRadius * Math.sin(labelAngle);
      
      svg += `<text class="wheel-month-label" x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle">${month}</text>`;
    });
    
    svg += `<circle class="wheel-center" cx="${center}" cy="${center}" r="${innerRadius - 5}"/>`;
    svg += '</svg>';
    
    wheelContainer.innerHTML = svg;
    
    // Season cards
    const seasons = [
      { name: 'Spring', months: 'March - May', indices: [2, 3, 4] },
      { name: 'Summer', months: 'June - August', indices: [5, 6, 7] },
      { name: 'Autumn', months: 'September - November', indices: [8, 9, 10] },
      { name: 'Winter', months: 'December - February', indices: [11, 0, 1] }
    ];
    
    const cardsContainer = document.getElementById('season-cards');
    if (cardsContainer) {
      cardsContainer.innerHTML = seasons.map(season => {
        const count = season.indices.reduce((sum, i) => sum + (monthCounts[i] || 0), 0);
        return `
          <div class="season-card">
            <div class="season-name">${season.name}</div>
            <div class="season-months">${season.months}</div>
            <div class="season-count">${count.toLocaleString()} sightings</div>
          </div>
        `;
      }).join('');
    }
  }
  
  // =========================================
  // Insights
  // =========================================
  populateInsights() {
    const grid = document.getElementById('insights-grid');
    const subtitle = document.getElementById('insights-subtitle');
    
    if (!grid) return;
    
    // Use filtered occurrences
    const filteredOccurrences = this.getFilteredOccurrences();
    const totalRecords = filteredOccurrences.length;
    
    // Compute year/month/region data from filtered occurrences
    const filteredYearData = {};
    const filteredMonthData = {};
    const filteredRegionData = {};
    
    filteredOccurrences.forEach(occ => {
      const year = occ.year;
      if (year) {
        if (!filteredYearData[year]) filteredYearData[year] = [];
        filteredYearData[year].push(occ);
      }
      
      const month = occ.month;
      if (month) {
        const monthNum = parseInt(month);
        if (!filteredMonthData[monthNum]) filteredMonthData[monthNum] = [];
        filteredMonthData[monthNum].push(occ);
      }
      
      const region = occ.stateProvince || 'Unknown';
      if (!filteredRegionData[region]) filteredRegionData[region] = [];
      filteredRegionData[region].push(occ);
    });
    
    const years = Object.keys(filteredYearData).map(Number).sort((a, b) => a - b);
    const firstYear = years[0] || 'N/A';
    const lastYear = years[years.length - 1] || 'N/A';
    const yearSpan = years.length > 1 ? lastYear - firstYear + 1 : 1;
    
    // Peak year
    const peakYear = years.reduce((max, year) => {
      const count = filteredYearData[year]?.length || 0;
      return count > (filteredYearData[max]?.length || 0) ? year : max;
    }, years[0]);
    const peakYearCount = filteredYearData[peakYear]?.length || 0;
    
    // Top region
    const regions = Object.entries(filteredRegionData)
      .filter(([r]) => r !== 'Unknown')
      .sort((a, b) => b[1].length - a[1].length);
    const topRegion = regions[0]?.[0] || 'Unknown';
    const topRegionPct = totalRecords > 0 ? ((regions[0]?.[1].length || 0) / totalRecords * 100).toFixed(1) : '0';
    
    // Breeding season (Mar-Jul for birds, or peak months)
    const monthCounts = {};
    for (let i = 1; i <= 12; i++) {
      monthCounts[i] = filteredMonthData[i]?.length || 0;
    }
    
    const breedingMonths = [3, 4, 5, 6, 7];
    const breedingCount = breedingMonths.reduce((sum, m) => sum + monthCounts[m], 0);
    const totalWithMonth = Object.values(monthCounts).reduce((a, b) => a + b, 0);
    const breedingPct = totalWithMonth > 0 ? ((breedingCount / totalWithMonth) * 100).toFixed(0) : '0';
    
    // Decade comparison
    const decade2010s = years.filter(y => y >= 2010 && y < 2020);
    const decade2020s = years.filter(y => y >= 2020);
    
    const avg2010s = decade2010s.length > 0 
      ? decade2010s.reduce((sum, y) => sum + (filteredYearData[y]?.length || 0), 0) / decade2010s.length 
      : 0;
    const avg2020s = decade2020s.length > 0 
      ? decade2020s.reduce((sum, y) => sum + (filteredYearData[y]?.length || 0), 0) / decade2020s.length 
      : 0;
    
    const trendPct = avg2010s > 0 ? (((avg2020s - avg2010s) / avg2010s) * 100).toFixed(0) : 'N/A';
    const trendSign = parseInt(trendPct) > 0 ? '+' : '';
    
    // Update subtitle
    if (subtitle) {
      subtitle.textContent = `Key findings from analyzing ${yearSpan} years of ${this.species.commonName || this.species.scientificName} observations across Britain.`;
    }
    
    // Generate insight cards
    grid.innerHTML = `
      <div class="insight-card insight-trend">
        <div class="insight-icon">📈</div>
        <div class="insight-value">${trendPct !== 'N/A' ? trendSign + trendPct + '%' : 'N/A'}</div>
        <div class="insight-label">2020s vs 2010s Trend</div>
        <p class="insight-detail">Comparing average annual sightings between the 2010s and 2020s.</p>
      </div>
      
      <div class="insight-card insight-breeding">
        <div class="insight-icon">📅</div>
        <div class="insight-value">${breedingPct}%</div>
        <div class="insight-label">Peak Season (Mar-Jul)</div>
        <p class="insight-detail">Percentage of records occurring during the spring and early summer months.</p>
      </div>
      
      <div class="insight-card insight-hotspot">
        <div class="insight-icon">📍</div>
        <div class="insight-value">${topRegion}</div>
        <div class="insight-label">Top Region (${topRegionPct}%)</div>
        <p class="insight-detail">The area with the highest concentration of recorded sightings.</p>
      </div>
      
      <div class="insight-card insight-peak">
        <div class="insight-icon">🏆</div>
        <div class="insight-value">${peakYear}</div>
        <div class="insight-label">Peak Year (${peakYearCount.toLocaleString()})</div>
        <p class="insight-detail">The year with the most recorded observations in the dataset.</p>
      </div>
      
      <div class="insight-card insight-span">
        <div class="insight-icon">📚</div>
        <div class="insight-value">${yearSpan} Years</div>
        <div class="insight-label">Data Range (${firstYear}-${lastYear})</div>
        <p class="insight-detail">The total time span covered by occurrence records.</p>
      </div>
      
      <div class="insight-card insight-total">
        <div class="insight-icon">🔢</div>
        <div class="insight-value">${totalRecords.toLocaleString()}</div>
        <div class="insight-label">Total Records</div>
        <p class="insight-detail">The complete number of occurrence observations available.</p>
      </div>
    `;
  }
  
  // =========================================
  // Data Explorer
  // =========================================
  initExplorer() {
    this.explorerPage = 1;
    this.explorerPageSize = 50;
    this.explorerSort = { key: 'year', dir: 'desc' };
    this.filteredData = [...this.getFilteredOccurrences()];
    
    this.populateRegionFilter();
    this.bindExplorerEvents();
    this.updateExplorerTable();
  }
  
  populateRegionFilter() {
    const regionSelect = document.getElementById('filter-region');
    if (!regionSelect) return;
    
    // Clear existing options except first
    while (regionSelect.options.length > 1) {
      regionSelect.remove(1);
    }
    
    const regions = Object.keys(this.regionData).sort();
    regions.forEach(region => {
      if (region && region !== 'Unknown') {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
      }
    });
  }
  
  bindExplorerEvents() {
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');
    const exportBtn = document.getElementById('export-csv');
    const prevBtn = document.getElementById('page-prev');
    const nextBtn = document.getElementById('page-next');
    
    if (applyBtn) {
      applyBtn.onclick = () => this.applyFilters();
    }
    
    if (resetBtn) {
      resetBtn.onclick = () => this.resetFilters();
    }
    
    if (exportBtn) {
      exportBtn.onclick = () => this.exportCSV();
    }
    
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.explorerPage > 1) {
          this.explorerPage--;
          this.updateExplorerTable();
        }
      };
    }
    
    if (nextBtn) {
      nextBtn.onclick = () => {
        const totalPages = Math.ceil(this.filteredData.length / this.explorerPageSize);
        if (this.explorerPage < totalPages) {
          this.explorerPage++;
          this.updateExplorerTable();
        }
      };
    }
    
    // Table header sorting
    const headers = document.querySelectorAll('.data-table th[data-sort]');
    headers.forEach(header => {
      header.onclick = () => {
        const key = header.dataset.sort;
        if (this.explorerSort.key === key) {
          this.explorerSort.dir = this.explorerSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this.explorerSort.key = key;
          this.explorerSort.dir = 'asc';
        }
        this.sortFilteredData();
        this.updateExplorerTable();
      };
    });
  }
  
  applyFilters() {
    const yearMin = parseInt(document.getElementById('filter-year-min')?.value) || null;
    const yearMax = parseInt(document.getElementById('filter-year-max')?.value) || null;
    const region = document.getElementById('filter-region')?.value || '';
    const month = parseInt(document.getElementById('filter-month')?.value) || null;
    const season = document.getElementById('filter-season')?.value || '';
    
    const seasonMonths = {
      spring: [3, 4, 5],
      summer: [6, 7, 8],
      autumn: [9, 10, 11],
      winter: [12, 1, 2]
    };
    
    // Start from location-filtered occurrences, then apply explorer filters
    this.filteredData = this.getFilteredOccurrences().filter(occ => {
      if (yearMin && occ.year < yearMin) return false;
      if (yearMax && occ.year > yearMax) return false;
      if (region && occ.stateProvince !== region) return false;
      
      if (month) {
        const occMonth = parseInt(occ.month);
        if (occMonth !== month) return false;
      } else if (season && seasonMonths[season]) {
        const occMonth = parseInt(occ.month);
        if (!seasonMonths[season].includes(occMonth)) return false;
      }
      
      return true;
    });
    
    this.sortFilteredData();
    this.explorerPage = 1;
    this.updateExplorerTable();
  }
  
  resetFilters() {
    const yearMin = document.getElementById('filter-year-min');
    const yearMax = document.getElementById('filter-year-max');
    const region = document.getElementById('filter-region');
    const month = document.getElementById('filter-month');
    const season = document.getElementById('filter-season');
    
    if (yearMin) yearMin.value = '';
    if (yearMax) yearMax.value = '';
    if (region) region.value = '';
    if (month) month.value = '';
    if (season) season.value = '';
    
    // Reset to location-filtered occurrences (respects current location filter)
    this.filteredData = [...this.getFilteredOccurrences()];
    this.explorerPage = 1;
    this.sortFilteredData();
    this.updateExplorerTable();
  }
  
  sortFilteredData() {
    const { key, dir } = this.explorerSort;
    
    this.filteredData.sort((a, b) => {
      let aVal, bVal;
      
      switch (key) {
        case 'year': aVal = a.year || 0; bVal = b.year || 0; break;
        case 'month': aVal = parseInt(a.month) || 0; bVal = parseInt(b.month) || 0; break;
        case 'region': aVal = a.stateProvince || ''; bVal = b.stateProvince || ''; break;
        case 'lat': aVal = a.decimalLatitude || 0; bVal = b.decimalLatitude || 0; break;
        case 'lng': aVal = a.decimalLongitude || 0; bVal = b.decimalLongitude || 0; break;
        case 'basis': aVal = a.basisOfRecord || ''; bVal = b.basisOfRecord || ''; break;
        default: aVal = a[key] || ''; bVal = b[key] || '';
      }
      
      if (typeof aVal === 'string') {
        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return dir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    const headers = document.querySelectorAll('.data-table th[data-sort]');
    headers.forEach(h => {
      h.removeAttribute('data-sort-active');
      if (h.dataset.sort === key) {
        h.setAttribute('data-sort-active', dir);
      }
    });
  }
  
  updateExplorerTable() {
    const tbody = document.getElementById('data-table-body');
    const countEl = document.getElementById('filtered-count');
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const prevBtn = document.getElementById('page-prev');
    const nextBtn = document.getElementById('page-next');
    
    if (!tbody) return;
    
    const totalRecords = this.filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / this.explorerPageSize));
    
    this.explorerPage = Math.min(this.explorerPage, totalPages);
    this.explorerPage = Math.max(1, this.explorerPage);
    
    if (countEl) countEl.textContent = totalRecords.toLocaleString();
    if (currentPageEl) currentPageEl.textContent = this.explorerPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    
    if (prevBtn) prevBtn.disabled = this.explorerPage <= 1;
    if (nextBtn) nextBtn.disabled = this.explorerPage >= totalPages;
    
    const startIdx = (this.explorerPage - 1) * this.explorerPageSize;
    const endIdx = startIdx + this.explorerPageSize;
    const pageData = this.filteredData.slice(startIdx, endIdx);
    
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="data-table-empty">
            No records match your filter criteria
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = pageData.map(occ => {
      const month = parseInt(occ.month);
      const monthName = monthNames[month] || '—';
      const lat = occ.decimalLatitude ? occ.decimalLatitude.toFixed(4) : '—';
      const lng = occ.decimalLongitude ? occ.decimalLongitude.toFixed(4) : '—';
      const basis = this.formatBasisOfRecord(occ.basisOfRecord);
      
      return `
        <tr>
          <td>${occ.year || '—'}</td>
          <td>${monthName}</td>
          <td>${occ.stateProvince || '—'}</td>
          <td>${lat}</td>
          <td>${lng}</td>
          <td>${basis}</td>
        </tr>
      `;
    }).join('');
  }
  
  formatBasisOfRecord(basis) {
    if (!basis) return '—';
    return basis.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }
  
  exportCSV() {
    if (this.filteredData.length === 0) {
      alert('No data to export. Please adjust your filters.');
      return;
    }
    
    const headers = ['Year', 'Month', 'Region', 'Latitude', 'Longitude', 'Record Type', 'Scientific Name', 'Vernacular Name'];
    
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const rows = this.filteredData.map(occ => {
      const month = parseInt(occ.month);
      return [
        occ.year || '',
        monthNames[month] || '',
        occ.stateProvince || '',
        occ.decimalLatitude || '',
        occ.decimalLongitude || '',
        occ.basisOfRecord || '',
        occ.scientificName || this.species.scientificName,
        occ.vernacularName || this.species.commonName
      ].map(val => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const speciesName = (this.species.commonName || this.species.scientificName).replace(/\s+/g, '-').toLowerCase();
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${speciesName}-occurrences-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SpeciesExplorer();
});
