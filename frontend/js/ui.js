/**
 * UI & Animations Module
 * Handles Lenis smooth scroll, mobile menu, scroll animations, and general UI interactions.
 */

let observer;

export const initUI = () => {
  // --- Global Image Load Error Handler (for blocked domains like Unsplash in Egypt) ---
  window.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      const src = e.target.src || '';
      console.warn('Image failed to load, applying unblocked fallback:', src);
      if (src.includes('unsplash.com')) {
        e.target.src = `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 100)}`;
      } else if (src.includes('pravatar.cc') || e.target.closest('.team-photo')) {
        e.target.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${e.target.alt || 'Avatar'}`;
      } else {
        e.target.src = 'https://picsum.photos/800/600';
      }
    }
  }, true);

  // --- Initialize Lenis Smooth Scroll ---
  if (typeof Lenis !== "undefined") {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // --- Mobile Menu Toggle ---
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const closeMenuBtn = document.querySelector('.close-menu-btn');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileMenuBtn && navMenu) {
    const mobileMenuIcon = mobileMenuBtn.querySelector('.material-symbols-rounded');

    mobileMenuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      if (navMenu.classList.contains('active')) {
        if (mobileMenuIcon) mobileMenuIcon.textContent = 'close';
        document.querySelector('.header')?.classList.add('scrolled');
      } else {
        if (mobileMenuIcon) mobileMenuIcon.textContent = 'menu';
        if (window.scrollY <= 10) document.querySelector('.header')?.classList.remove('scrolled');
      }
    });

    if (closeMenuBtn) {
      closeMenuBtn.addEventListener('click', () => {
        navMenu.classList.remove('active');
        if (mobileMenuIcon) mobileMenuIcon.textContent = 'menu';
      });
    }

    // Close mobile menu when a navigation link is clicked (mobile only)
    // Keep menu visible with smooth loading state during page transition
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        if (navMenu.classList.contains('active')) {
          // Add a gentle loading indicator
          const loadingOverlay = document.createElement('div');
          loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(2px);
            z-index: 9998;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
          `;
          document.body.appendChild(loadingOverlay);
          
          // Fade in the overlay smoothly
          setTimeout(() => {
            loadingOverlay.style.opacity = '1';
          }, 10);
        }
        // Menu and overlay will disappear when new page loads
      });
    });

    // Close mobile menu when theme or language toggle buttons are clicked (mobile only)
    const themeToggle = document.getElementById('theme-toggle');
    const langToggle = document.getElementById('lang-toggle');
    [themeToggle, langToggle].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          navMenu.classList.remove('active');
          if (mobileMenuIcon) mobileMenuIcon.textContent = 'menu';
          const openDropdowns = navMenu.querySelectorAll('.dropdown.open');
          openDropdowns.forEach(d => d.classList.remove('open'));
        });
      }
    });
  }


  // --- Logout button handling ---
  const logoutButtons = document.querySelectorAll('.btn-logout, [data-action="logout"]');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.logout === 'function') {
        window.logout();
      }
    });
  });

  // --- Mobile Search Bar Focus Interaction ---
  const navSearches = document.querySelectorAll('.nav-search');
  navSearches.forEach(searchBox => {
    searchBox.addEventListener('click', () => {
      const input = searchBox.querySelector('input');
      if (input) input.focus();
    });
  });

  // --- Scroll Observer ---
  const observerOptions = { threshold: 0.1 };
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        const activeObserver = observer || window.revealObserver;
        if (activeObserver) activeObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  window.revealObserver = observer;
  refreshAnimations();
};

export const refreshAnimations = () => {
  const activeObserver = observer || window.revealObserver;
  if (!activeObserver) return;
  document
    .querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .fade-in-up')
    .forEach((el) => {
      if (!el.classList.contains('reveal-visible')) {
        activeObserver.observe(el);
      }
    });
};
