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
      this.initDataSources();
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
  // Interactive UK Map
  // =========================================
  initMap() {
    const mapWrapper = document.getElementById('uk-map');
    if (!mapWrapper) return;
    
    // Create SVG map with occurrence dots
    this.createMapVisualization(mapWrapper);
    
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
        this.updateMapDots();
        this.updateRegionStats();
      });
    }
    
    this.updateRegionStats();
  }
  
  createMapVisualization(container) {
    // UK bounding box (approximate)
    const ukBounds = {
      minLat: 49.5,
      maxLat: 61,
      minLng: -8.5,
      maxLng: 2
    };
    
    const width = 400;
    const height = 600;
    
    // Project coordinates to SVG space
    const projectLat = (lat) => {
      const normalized = (ukBounds.maxLat - lat) / (ukBounds.maxLat - ukBounds.minLat);
      return normalized * height * 0.9 + height * 0.05;
    };
    
    const projectLng = (lng) => {
      const normalized = (lng - ukBounds.minLng) / (ukBounds.maxLng - ukBounds.minLng);
      return normalized * width * 0.9 + width * 0.05;
    };
    
    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'uk-map-svg');
    
    // Add UK outline using geographic coordinates (simplified Great Britain + Ireland outline)
    const ukCoords = this.getUKCoordinates();
    
    // Convert geographic coords to SVG path
    ukCoords.forEach((region, idx) => {
      const pathData = region.map((point, i) => {
        const x = projectLng(point[1]);
        const y = projectLat(point[0]);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ') + ' Z';
      
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      outline.setAttribute('d', pathData);
      outline.setAttribute('fill', '#EDE6D6');
      outline.setAttribute('stroke', '#A0522D');
      outline.setAttribute('stroke-width', '1.5');
      outline.setAttribute('class', 'uk-region');
      svg.appendChild(outline);
    });
    
    // Create dots group (on top of the map)
    this.dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.dotsGroup.setAttribute('class', 'occurrence-dots');
    svg.appendChild(this.dotsGroup);
    
    // Store projection functions
    this.projectLat = projectLat;
    this.projectLng = projectLng;
    
    container.appendChild(svg);
    
    // Initial dots
    this.updateMapDots();
  }
  
  updateMapDots() {
    if (!this.dotsGroup) return;
    
    // Clear existing dots
    this.dotsGroup.innerHTML = '';
    
    // Get occurrences for current year
    let occurrences;
    if (this.currentYear === 'all') {
      occurrences = this.data.occurrences;
    } else {
      occurrences = this.yearData[this.currentYear] || [];
    }
    
    // Sample for performance (show up to 2000 dots)
    const sampleSize = Math.min(occurrences.length, 2000);
    const step = Math.max(1, Math.floor(occurrences.length / sampleSize));
    
    for (let i = 0; i < occurrences.length; i += step) {
      const occ = occurrences[i];
      if (occ.decimalLatitude && occ.decimalLongitude) {
        const x = this.projectLng(occ.decimalLongitude);
        const y = this.projectLat(occ.decimalLatitude);
        
        // Only add if within reasonable bounds
        if (x > 0 && x < 400 && y > 0 && y < 600) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', x);
          dot.setAttribute('cy', y);
          dot.setAttribute('r', '3');
          dot.setAttribute('class', 'occurrence-dot');
          dot.setAttribute('data-species', occ.vernacularName || occ.scientificName);
          dot.setAttribute('data-year', occ.year);
          
          this.dotsGroup.appendChild(dot);
        }
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
  
  getUKCoordinates() {
    // Simplified UK outline coordinates [lat, lng] - Great Britain main island
    const greatBritain = [
      // Start SW Cornwall, go clockwise
      [50.07, -5.71], [50.15, -5.07], [50.37, -4.67], [50.55, -4.19], 
      [50.35, -3.55], [50.60, -2.98], [50.72, -1.95], [50.77, -1.30],
      [50.74, -0.77], [50.90, 0.25], [50.96, 0.97], [51.10, 1.35],
      // East coast going north  
      [51.38, 1.42], [51.75, 1.29], [51.88, 1.08], [52.08, 1.63],
      [52.48, 1.76], [52.95, 1.47], [53.08, 0.34], [53.33, 0.08],
      [53.75, -0.12], [54.09, -0.17], [54.50, -0.61], [54.65, -1.17],
      [55.00, -1.42], [55.45, -1.55], [55.77, -1.82], [55.98, -2.03],
      // Scottish east coast
      [56.20, -2.52], [56.47, -2.95], [56.71, -2.48], [57.00, -2.07],
      [57.42, -1.78], [57.69, -1.85], [58.00, -3.02], [58.44, -3.10],
      [58.62, -3.55], [58.55, -4.43], [58.32, -4.80],
      // North Scotland
      [58.60, -4.98], [58.45, -5.10], [57.90, -5.20], [57.53, -5.63],
      [57.27, -5.80], [57.00, -5.85], [56.73, -6.10], [56.50, -5.67],
      // West Scotland  
      [56.23, -5.50], [55.90, -5.38], [55.58, -4.85], [55.43, -4.90],
      [55.00, -5.05], [54.70, -5.10], [54.50, -4.62], [54.22, -4.38],
      // Irish Sea coast
      [54.05, -4.50], [53.42, -4.35], [53.32, -4.55], [53.22, -4.12],
      [53.10, -4.08], [52.90, -4.47], [52.60, -4.15], [52.27, -4.08],
      [51.87, -4.95], [51.68, -5.03], [51.55, -4.22], [51.45, -3.20],
      [51.38, -3.43], [51.20, -3.15],
      // Bristol Channel & South Wales
      [51.18, -4.20], [51.00, -4.18], [50.77, -3.60], [50.50, -3.52],
      [50.35, -4.12], [50.23, -4.78], [50.07, -5.71]
    ];
    
    // Ireland outline (simplified)
    const ireland = [
      [51.45, -10.00], [51.78, -10.20], [52.15, -10.35], [52.55, -9.90],
      [53.05, -9.55], [53.32, -9.85], [53.52, -10.05], [53.85, -9.70],
      [54.22, -10.02], [54.47, -8.42], [55.05, -8.10], [55.25, -7.42],
      [55.38, -6.95], [55.20, -6.10], [54.95, -5.88], [54.65, -5.70],
      [54.40, -5.95], [54.10, -6.35], [53.75, -6.10], [53.42, -6.05],
      [53.20, -6.10], [52.95, -6.05], [52.55, -6.35], [52.15, -6.95],
      [51.85, -7.55], [51.55, -8.55], [51.45, -9.50], [51.45, -10.00]
    ];
    
    return [greatBritain, ireland];
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
  
  // =========================================
  // Data Sources
  // =========================================
  initDataSources() {
    const container = document.getElementById('data-sources');
    if (!container) return;
    
    const dataResourceFacet = this.summary.facets?.find(f => f.fieldName === 'data_resource_uid');
    if (!dataResourceFacet) return;
    
    const maxCount = Math.max(...dataResourceFacet.fieldResult.map(r => r.count));
    
    container.innerHTML = dataResourceFacet.fieldResult.slice(0, 8).map(resource => {
      const widthPercent = (resource.count / maxCount) * 100;
      return `
        <div class="source-card">
          <div class="source-name">${resource.label}</div>
          <div class="source-count">${resource.count.toLocaleString()}</div>
          <div class="source-bar">
            <div class="source-bar-fill" style="width: ${widthPercent}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WoodlarkApp();
});
