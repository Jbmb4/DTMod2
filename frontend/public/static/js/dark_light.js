const PANEL_THEMES = {
  violet: { accent: '#7c3aed', rgb: '124, 58, 237', ink: '#ffffff' },
  sky: { accent: '#0284c7', rgb: '2, 132, 199', ink: '#ffffff' },
  mint: { accent: '#059669', rgb: '5, 150, 105', ink: '#ffffff' },
  orange: { accent: '#c2410c', rgb: '194, 65, 12', ink: '#ffffff' },
  navy: { accent: '#1d4ed8', rgb: '29, 78, 216', ink: '#ffffff' },
  pink: { accent: '#be185d', rgb: '190, 24, 93', ink: '#ffffff' },
  teal: { accent: '#0f766e', rgb: '15, 118, 110', ink: '#ffffff' },
  amber: { accent: '#a16207', rgb: '161, 98, 7', ink: '#ffffff' },
};

const applyPanelTheme = (themeName) => {
  const selectedName = Object.prototype.hasOwnProperty.call(PANEL_THEMES, themeName) ? themeName : 'teal';
  const selectedTheme = PANEL_THEMES[selectedName];
  const root = document.documentElement;

  root.dataset.panelTheme = selectedName;
  root.style.setProperty('--panel-accent', selectedTheme.accent);
  root.style.setProperty('--panel-accent-rgb', selectedTheme.rgb);
  root.style.setProperty('--panel-accent-strong', selectedTheme.accent);
  root.style.setProperty('--panel-accent-ink', selectedTheme.ink);
  root.style.setProperty('--auth-accent', selectedTheme.accent);
  root.style.setProperty('--auth-accent-rgb', selectedTheme.rgb);
  root.style.setProperty('--auth-accent-ink', selectedTheme.ink);

  document.querySelectorAll('.panel-theme-swatch').forEach((swatch) => {
    const isSelected = swatch.dataset.panelTheme === selectedName;
    swatch.classList.toggle('is-selected', isSelected);
    swatch.setAttribute('aria-pressed', String(isSelected));
  });
};

const setDarkMode = () => document.documentElement.setAttribute('data-bs-theme', 'dark');
const setLightMode = setDarkMode;
const swithTheme = setDarkMode;

setDarkMode();
let savedPanelTheme = 'teal';
try {
  savedPanelTheme = localStorage.getItem('dtmod-panel-theme') || 'teal';
} catch (_) {
  // Use the default palette if the browser blocks local storage.
}
applyPanelTheme(savedPanelTheme);

document.addEventListener('DOMContentLoaded', () => {
  const swatches = document.querySelectorAll('.panel-theme-swatch');
  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const themeName = swatch.dataset.panelTheme;
      applyPanelTheme(themeName);
      try {
        localStorage.setItem('dtmod-panel-theme', themeName);
      } catch (_) {
        // The selected theme still applies to this page if storage is unavailable.
      }
      document.querySelector('#toggle-theme-btn')?.focus();
      const palette = document.querySelector('#theme-palette');
      const trigger = document.querySelector('#toggle-theme-btn');
      if (palette && trigger) {
        palette.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  const trigger = document.querySelector('#toggle-theme-btn');
  const palette = document.querySelector('#theme-palette');
  if (!trigger || !palette) return;

  const closePalette = () => {
    palette.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', () => {
    const isOpening = palette.hidden;
    palette.hidden = !isOpening;
    trigger.setAttribute('aria-expanded', String(isOpening));
  });

  document.addEventListener('click', (event) => {
    if (!palette.contains(event.target) && !trigger.contains(event.target)) closePalette();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePalette();
  });
});
