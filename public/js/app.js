/**
 * The Song of the Woodlark - Main Application
 * Interactive data visualization for NBN Atlas Woodlark occurrences
 */

class WoodlarkApp {
  constructor() {
    this.data = null;
    this.summary = null;
    this.yearData = {};
    this.monthData = {};
    this.regionData = {};
    this.currentYear = 'all';
    
    this.init();
  }
  
  async init() {
    try {
      await this.loadData();
      this.processData();
      this.hideLoading();
      this.initAnimations();
      this.initMap();
      this.initTimeline();
      this.initSeasonalWheel();
      this.initScrollAnimations();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError(error.message);
    }
  }
  
  async loadData() {
    const [occurrencesRes, summaryRes] = await Promise.all([
      fetch('/data/woodlark-occurrences.json'),
      fetch('/data/summary.json')
    ]);
    
    if (!occurrencesRes.ok || !summaryRes.ok) {
      throw new Error('Failed to load data files');
    }
    
    this.data = await occurrencesRes.json();
    this.summary = await summaryRes.json();
  }
  
  processData() {
    // Process by year
    this.data.occurrences.forEach(occ => {
      const year = occ.year;
      if (year) {
        if (!this.yearData[year]) {
          this.yearData[year] = [];
        }
        this.yearData[year].push(occ);
      }
      
      // Process by month
      const month = occ.month;
      if (month) {
        const monthNum = parseInt(month);
        if (!this.monthData[monthNum]) {
          this.monthData[monthNum] = [];
        }
        this.monthData[monthNum].push(occ);
      }
      
      // Process by region
      const region = occ.stateProvince || 'Unknown';
      if (!this.regionData[region]) {
        this.regionData[region] = [];
      }
      this.regionData[region].push(occ);
    });
    
    // Sort years
    this.years = Object.keys(this.yearData).map(Number).sort((a, b) => a - b);
  }
  
  hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      setTimeout(() => {
        loading.classList.add('hidden');
        // Trigger initial animations
        this.animateHeroCounter();
      }, 500);
    }
  }
  
  showError(message) {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.innerHTML = `
        <div class="error-message">
          <p>Failed to load data: ${message}</p>
          <p>Please ensure data files exist in /data directory</p>
        </div>
      `;
    }
  }
  
  initAnimations() {
    // Flying birds
    const birdsContainer = document.getElementById('flying-birds');
    if (birdsContainer) {
      this.flyingBirds = new FlyingBirds(birdsContainer);
    }
    
    // Floating particles
    const particlesContainer = document.getElementById('particles');
    if (particlesContainer) {
      this.particles = new FloatingParticles(particlesContainer, 25);
    }
  }
  
  animateHeroCounter() {
    const counterEl = document.getElementById('total-counter');
    if (counterEl) {
      animateCounter(counterEl, this.data.totalRecords, 2500);
    }
  }
  
  initScrollAnimations() {
    new ScrollAnimations();
  }
  
  // =========================================
  // Interactive UK Map with Leaflet
  // =========================================
  initMap() {
    const mapContainer = document.getElementById('uk-map');
    if (!mapContainer) return;
    
    // Initialize Leaflet map centered on UK
    this.map = L.map('uk-map', {
      center: [54.5, -2.5],
      zoom: 5,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: true,
      scrollWheelZoom: true
    });
    
    // Add OpenStreetMap tiles with a warm, natural style
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      opacity: 0.85
    }).addTo(this.map);
    
    // Create a layer group for occurrence markers
    this.markersLayer = L.layerGroup().addTo(this.map);
    
    // Year slider
    const yearSlider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-display');
    
    if (yearSlider && this.years.length > 0) {
      yearSlider.min = 0;
      yearSlider.max = this.years.length;
      yearSlider.value = this.years.length; // Start at "all"
      
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
    
    // Initial markers
    this.updateMapMarkers();
    this.updateRegionStats();
  }
  
  updateMapMarkers() {
    if (!this.markersLayer) return;
    
    // Clear existing markers
    this.markersLayer.clearLayers();
    
    // Get occurrences for current year
    let occurrences;
    if (this.currentYear === 'all') {
      occurrences = this.data.occurrences;
    } else {
      occurrences = this.yearData[this.currentYear] || [];
    }
    
    // Custom icon for woodlark sightings
    const woodlarkIcon = L.divIcon({
      className: 'woodlark-marker',
      html: '<div class="marker-dot"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    
    // Sample for performance (show up to 3000 markers)
    const sampleSize = Math.min(occurrences.length, 3000);
    const step = Math.max(1, Math.floor(occurrences.length / sampleSize));
    
    for (let i = 0; i < occurrences.length; i += step) {
      const occ = occurrences[i];
      if (occ.decimalLatitude && occ.decimalLongitude) {
        const marker = L.circleMarker([occ.decimalLatitude, occ.decimalLongitude], {
          radius: 4,
          fillColor: '#A0522D',
          color: '#5D4E37',
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.6
        });
        
        // Add popup with occurrence info
        const popupContent = `
          <strong>${occ.vernacularName || occ.scientificName}</strong><br>
          <span style="color: #8B7355;">Year: ${occ.year || 'Unknown'}</span><br>
          <span style="color: #8B7355;">${occ.stateProvince || ''}</span>
        `;
        marker.bindPopup(popupContent);
        
        this.markersLayer.addLayer(marker);
      }
    }
  }
  
  updateRegionStats() {
    const statsContainer = document.getElementById('region-stats');
    if (!statsContainer) return;
    
    // Calculate counts for current selection
    let regionCounts = {};
    
    let occurrences;
    if (this.currentYear === 'all') {
      occurrences = this.data.occurrences;
    } else {
      occurrences = this.yearData[this.currentYear] || [];
    }
    
    occurrences.forEach(occ => {
      const region = occ.stateProvince || 'Unknown';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });
    
    // Sort by count
    const sorted = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    
    statsContainer.innerHTML = sorted.map(([name, count]) => `
      <div class="region-stat">
        <span class="region-name">${name}</span>
        <span class="region-count">${count.toLocaleString()}</span>
      </div>
    `).join('');
  }
  
  // =========================================
  // Timeline Visualization
  // =========================================
  initTimeline() {
    const track = document.getElementById('timeline-track');
    const tooltip = document.getElementById('timeline-tooltip');
    if (!track) return;
    
    // Get year facet data from summary
    const yearFacet = this.summary.facets?.find(f => f.fieldName === 'year');
    const yearCounts = {};
    
    if (yearFacet) {
      yearFacet.fieldResult.forEach(item => {
        yearCounts[item.label] = item.count;
      });
    }
    
    // Also compute from raw data
    Object.entries(this.yearData).forEach(([year, occs]) => {
      if (!yearCounts[year]) {
        yearCounts[year] = occs.length;
      }
    });
    
    const maxCount = Math.max(...Object.values(yearCounts));
    
    // Create bars for each year
    const allYears = Object.keys(yearCounts).map(Number).sort((a, b) => a - b);
    
    allYears.forEach(year => {
      const count = yearCounts[year] || 0;
      const heightPercent = (count / maxCount) * 100;
      
      const bar = document.createElement('div');
      bar.className = 'timeline-bar';
      bar.setAttribute('data-year', year);
      bar.setAttribute('data-count', count);
      bar.style.height = `${Math.max(heightPercent, 2)}%`;
      
      bar.addEventListener('mouseenter', (e) => {
        this.showTimelineTooltip(tooltip, e.target, year, count);
      });
      
      bar.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
      });
      
      bar.addEventListener('click', () => {
        // Update map to this year
        const yearSlider = document.getElementById('year-slider');
        const yearDisplay = document.getElementById('year-display');
        if (yearSlider) {
          const idx = this.years.indexOf(year);
          if (idx !== -1) {
            yearSlider.value = idx;
            this.currentYear = year;
            yearDisplay.textContent = year;
            this.updateMapDots();
            this.updateRegionStats();
          }
        }
        
        // Highlight this bar
        track.querySelectorAll('.timeline-bar').forEach(b => b.classList.remove('active'));
        bar.classList.add('active');
      });
      
      track.appendChild(bar);
    });
    
    // Add decade markers
    this.addDecadeMarkers(allYears);
  }
  
  showTimelineTooltip(tooltip, bar, year, count) {
    tooltip.innerHTML = `
      <div class="tooltip-year">${year}</div>
      <div class="tooltip-count">${count.toLocaleString()} sightings</div>
    `;
    
    const rect = bar.getBoundingClientRect();
    const trackRect = bar.parentElement.getBoundingClientRect();
    
    tooltip.style.left = `${rect.left - trackRect.left + rect.width / 2}px`;
    tooltip.style.bottom = `${trackRect.bottom - rect.top + 10}px`;
    tooltip.classList.add('visible');
  }
  
  addDecadeMarkers(years) {
    const decadesContainer = document.getElementById('timeline-decades');
    if (!decadesContainer) return;
    
    const decades = [...new Set(years.map(y => Math.floor(y / 10) * 10))];
    
    decadesContainer.innerHTML = decades.map(decade => `
      <div class="decade-marker">${decade}s</div>
    `).join('');
  }
  
  // =========================================
  // Seasonal Wheel
  // =========================================
  initSeasonalWheel() {
    const wheelContainer = document.getElementById('seasonal-wheel');
    if (!wheelContainer) return;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Get monthly counts
    const monthCounts = months.map((_, i) => {
      return this.monthData[i + 1]?.length || 0;
    });
    
    const maxMonth = Math.max(...monthCounts);
    
    // Create SVG wheel
    const size = 400;
    const center = size / 2;
    const outerRadius = 180;
    const innerRadius = 60;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'seasonal-wheel');
    
    // Create segments
    months.forEach((month, i) => {
      const count = monthCounts[i];
      const radiusScale = innerRadius + (outerRadius - innerRadius) * (count / maxMonth);
      
      const startAngle = (i * 30 - 90) * Math.PI / 180;
      const endAngle = ((i + 1) * 30 - 90) * Math.PI / 180;
      
      // Inner arc
      const innerX1 = center + innerRadius * Math.cos(startAngle);
      const innerY1 = center + innerRadius * Math.sin(startAngle);
      const innerX2 = center + innerRadius * Math.cos(endAngle);
      const innerY2 = center + innerRadius * Math.sin(endAngle);
      
      // Outer arc (scaled by count)
      const outerX1 = center + radiusScale * Math.cos(startAngle);
      const outerY1 = center + radiusScale * Math.sin(startAngle);
      const outerX2 = center + radiusScale * Math.cos(endAngle);
      const outerY2 = center + radiusScale * Math.sin(endAngle);
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `
        M ${innerX1} ${innerY1}
        L ${outerX1} ${outerY1}
        A ${radiusScale} ${radiusScale} 0 0 1 ${outerX2} ${outerY2}
        L ${innerX2} ${innerY2}
        A ${innerRadius} ${innerRadius} 0 0 0 ${innerX1} ${innerY1}
        Z
      `);
      
      // Color based on season
      const seasonColors = {
        winter: '#7BA7BC',
        spring: '#4A6B5A',
        summer: '#D4A574',
        autumn: '#A0522D'
      };
      
      let season;
      if (i >= 2 && i <= 4) season = 'spring';
      else if (i >= 5 && i <= 7) season = 'summer';
      else if (i >= 8 && i <= 10) season = 'autumn';
      else season = 'winter';
      
      path.setAttribute('fill', seasonColors[season]);
      path.setAttribute('class', 'wheel-segment');
      path.setAttribute('data-month', month);
      path.setAttribute('data-count', count);
      
      svg.appendChild(path);
      
      // Month label
      const labelAngle = ((i + 0.5) * 30 - 90) * Math.PI / 180;
      const labelRadius = outerRadius + 25;
      const labelX = center + labelRadius * Math.cos(labelAngle);
      const labelY = center + labelRadius * Math.sin(labelAngle);
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', labelX);
      label.setAttribute('y', labelY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('class', 'wheel-month-label');
      label.textContent = month;
      svg.appendChild(label);
    });
    
    // Center circle
    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', center);
    centerCircle.setAttribute('cy', center);
    centerCircle.setAttribute('r', innerRadius - 5);
    centerCircle.setAttribute('class', 'wheel-center');
    svg.appendChild(centerCircle);
    
    // Center text
    const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerText.setAttribute('x', center);
    centerText.setAttribute('y', center);
    centerText.setAttribute('text-anchor', 'middle');
    centerText.setAttribute('dominant-baseline', 'middle');
    centerText.setAttribute('font-family', 'Playfair Display');
    centerText.setAttribute('font-size', '14');
    centerText.setAttribute('fill', '#5D4E37');
    centerText.textContent = 'Seasonal';
    
    const centerText2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerText2.setAttribute('x', center);
    centerText2.setAttribute('y', center + 16);
    centerText2.setAttribute('text-anchor', 'middle');
    centerText2.setAttribute('dominant-baseline', 'middle');
    centerText2.setAttribute('font-family', 'Playfair Display');
    centerText2.setAttribute('font-size', '14');
    centerText2.setAttribute('fill', '#5D4E37');
    centerText2.textContent = 'Distribution';
    
    svg.appendChild(centerText);
    svg.appendChild(centerText2);
    
    wheelContainer.appendChild(svg);
    
    // Season cards
    this.populateSeasonCards(monthCounts);
  }
  
  populateSeasonCards(monthCounts) {
    const seasons = [
      { name: 'Spring', months: 'March - May', indices: [2, 3, 4] },
      { name: 'Summer', months: 'June - August', indices: [5, 6, 7] },
      { name: 'Autumn', months: 'September - November', indices: [8, 9, 10] },
      { name: 'Winter', months: 'December - February', indices: [11, 0, 1] }
    ];
    
    const cardsContainer = document.getElementById('season-cards');
    if (!cardsContainer) return;
    
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WoodlarkApp();
});
