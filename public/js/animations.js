/**
 * Flying Woodlarks & Particle Animations
 * Creates animated SVG birds that fly across the viewport
 * and floating seed particles for atmosphere
 */

// Woodlark SVG template - stylized bird silhouette
const WOODLARK_SVG = `
<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g class="bird-body">
    <!-- Body -->
    <ellipse cx="50" cy="35" rx="25" ry="15" fill="#8B4513"/>
    <!-- Breast markings -->
    <ellipse cx="45" cy="38" rx="12" ry="10" fill="#D4A574"/>
    <!-- Streaked pattern -->
    <path d="M35 32 Q40 35, 35 38 Q40 41, 35 44" stroke="#5D4E37" stroke-width="1.5" fill="none"/>
    <path d="M42 30 Q47 33, 42 36 Q47 39, 42 42" stroke="#5D4E37" stroke-width="1.5" fill="none"/>
    <!-- Head -->
    <circle cx="28" cy="28" r="12" fill="#A0522D"/>
    <!-- Crest -->
    <path d="M22 20 Q25 12, 30 18" stroke="#5D4E37" stroke-width="2" fill="none"/>
    <path d="M25 19 Q28 13, 32 17" stroke="#5D4E37" stroke-width="1.5" fill="none"/>
    <!-- Eye stripe -->
    <path d="M18 26 Q28 24, 35 28" stroke="#F5E6D3" stroke-width="2" fill="none"/>
    <!-- Eye -->
    <circle cx="24" cy="26" r="3" fill="#2D4739"/>
    <circle cx="23" cy="25" r="1" fill="white"/>
    <!-- Beak -->
    <path d="M16 30 L10 32 L16 34 Z" fill="#DAA520"/>
    <!-- Wing -->
    <path class="wing" d="M45 25 Q70 15, 85 30 Q70 35, 55 35 Z" fill="#6B4423">
      <animateTransform 
        attributeName="transform" 
        type="rotate" 
        values="0 50 35; -15 50 35; 0 50 35" 
        dur="0.3s" 
        repeatCount="indefinite"/>
    </path>
    <!-- Tail -->
    <path d="M72 35 L95 30 L95 40 Z" fill="#5D4E37"/>
    <!-- Legs (tucked) -->
    <path d="M50 48 L48 55 M55 48 L57 55" stroke="#DAA520" stroke-width="2" fill="none"/>
  </g>
</svg>
`;

// Simplified soaring bird (wings spread)
const SOARING_SVG = `
<svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
  <g>
    <!-- Wings spread wide -->
    <path d="M60 20 Q30 5, 5 15 Q30 20, 60 20" fill="#8B4513"/>
    <path d="M60 20 Q90 5, 115 15 Q90 20, 60 20" fill="#8B4513"/>
    <!-- Body -->
    <ellipse cx="60" cy="22" rx="15" ry="8" fill="#A0522D"/>
    <!-- Head -->
    <circle cx="48" cy="20" r="6" fill="#A0522D"/>
    <!-- Beak -->
    <path d="M42 21 L38 22 L42 23 Z" fill="#DAA520"/>
    <!-- Tail -->
    <path d="M75 22 L90 18 L90 26 Z" fill="#5D4E37"/>
  </g>
</svg>
`;

class FlyingBirds {
  constructor(container) {
    this.container = container;
    this.birds = [];
    this.maxBirds = 5;
    this.isActive = true;
    
    this.init();
  }
  
  init() {
    // Spawn initial birds with delay
    for (let i = 0; i < this.maxBirds; i++) {
      setTimeout(() => this.spawnBird(), i * 3000);
    }
    
    // Continue spawning
    setInterval(() => {
      if (this.birds.length < this.maxBirds && this.isActive) {
        this.spawnBird();
      }
    }, 5000);
  }
  
  spawnBird() {
    const bird = document.createElement('div');
    bird.className = 'woodlark-svg';
    
    // Random size
    const size = 40 + Math.random() * 60;
    bird.style.width = `${size}px`;
    bird.style.height = `${size * 0.6}px`;
    
    // Use soaring or flapping based on random
    bird.innerHTML = Math.random() > 0.5 ? WOODLARK_SVG : SOARING_SVG;
    
    // Starting position (left or right side)
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -100 : window.innerWidth + 100;
    const endX = fromLeft ? window.innerWidth + 100 : -100;
    const startY = 50 + Math.random() * (window.innerHeight * 0.4);
    
    bird.style.left = `${startX}px`;
    bird.style.top = `${startY}px`;
    
    // Flip bird if flying right to left
    if (!fromLeft) {
      bird.style.transform = 'scaleX(-1)';
    }
    
    this.container.appendChild(bird);
    
    // Animate
    requestAnimationFrame(() => {
      bird.classList.add('visible');
    });
    
    // Flight path animation
    const duration = 15000 + Math.random() * 10000;
    const wobbleAmount = 30 + Math.random() * 50;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        bird.remove();
        this.birds = this.birds.filter(b => b !== bird);
        return;
      }
      
      // Calculate position with sine wave wobble
      const currentX = startX + (endX - startX) * progress;
      const wobble = Math.sin(progress * Math.PI * 4) * wobbleAmount;
      const currentY = startY + wobble - (progress * 50); // Slight upward drift
      
      bird.style.left = `${currentX}px`;
      bird.style.top = `${currentY}px`;
      
      // Subtle rotation based on wobble direction
      const rotation = Math.sin(progress * Math.PI * 4) * 10;
      const scaleX = fromLeft ? 1 : -1;
      bird.style.transform = `scaleX(${scaleX}) rotate(${rotation}deg)`;
      
      requestAnimationFrame(animate);
    };
    
    this.birds.push(bird);
    animate();
  }
  
  pause() {
    this.isActive = false;
  }
  
  resume() {
    this.isActive = true;
  }
}

class FloatingParticles {
  constructor(container, count = 30) {
    this.container = container;
    this.count = count;
    this.particles = [];
    
    this.init();
  }
  
  init() {
    for (let i = 0; i < this.count; i++) {
      this.createParticle(true);
    }
  }
  
  createParticle(initialSpawn = false) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random properties
    const size = 2 + Math.random() * 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    // Random starting position
    const startX = Math.random() * window.innerWidth;
    const startY = initialSpawn 
      ? Math.random() * window.innerHeight 
      : window.innerHeight + 20;
    
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    particle.style.opacity = 0.2 + Math.random() * 0.4;
    
    // Random color from palette
    const colors = ['#D4A574', '#A0522D', '#DAA520', '#C4883A'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    this.container.appendChild(particle);
    
    // Animate floating up
    const duration = 15000 + Math.random() * 20000;
    const swayAmount = 50 + Math.random() * 100;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        particle.remove();
        this.particles = this.particles.filter(p => p !== particle);
        this.createParticle(); // Respawn
        return;
      }
      
      // Float upward with horizontal sway
      const currentY = startY - (progress * (window.innerHeight + 100));
      const sway = Math.sin(progress * Math.PI * 3) * swayAmount;
      const currentX = startX + sway;
      
      particle.style.left = `${currentX}px`;
      particle.style.top = `${currentY}px`;
      
      // Fade out near top
      if (progress > 0.8) {
        particle.style.opacity = (1 - progress) * 2 * 0.4;
      }
      
      requestAnimationFrame(animate);
    };
    
    this.particles.push(particle);
    animate();
  }
}

// Scroll-triggered fade in animations
class ScrollAnimations {
  constructor() {
    this.elements = document.querySelectorAll('.fade-in, .stagger-children');
    this.init();
  }
  
  init() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    
    this.elements.forEach(el => observer.observe(el));
  }
}

// Count-up animation for numbers
function animateCounter(element, target, duration = 2000) {
  const start = 0;
  const startTime = Date.now();
  
  const update = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeProgress);
    
    element.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };
  
  update();
}

// Export for use in main app
window.FlyingBirds = FlyingBirds;
window.FloatingParticles = FloatingParticles;
window.ScrollAnimations = ScrollAnimations;
window.animateCounter = animateCounter;
