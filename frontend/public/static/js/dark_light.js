const PANEL_THEMES = {
  blue: { accent: '#3867f2', rgb: '56, 103, 242', ink: '#ffffff' },
  green: { accent: '#20c997', rgb: '32, 201, 151', ink: '#ffffff' },
  purple: { accent: '#7a4de8', rgb: '122, 77, 232', ink: '#ffffff' },
  orange: { accent: '#f0653f', rgb: '240, 101, 63', ink: '#ffffff' },
  lightblue: { accent: '#55a0e6', rgb: '85, 160, 230', ink: '#ffffff' },
  pink: { accent: '#e12e68', rgb: '225, 46, 104', ink: '#ffffff' },
  cyan: { accent: '#00c6c8', rgb: '0, 198, 200', ink: '#ffffff' },
  yellow: { accent: '#e4b000', rgb: '228, 176, 0', ink: '#ffffff' },
};

const applyPanelTheme = (themeName) => {
  const selectedName = Object.prototype.hasOwnProperty.call(PANEL_THEMES, themeName) ? themeName : 'blue';
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
let savedPanelTheme = 'blue';
try {
  savedPanelTheme = localStorage.getItem('dtmod-panel-theme') || 'blue';
} catch (_) {
  // Use the default palette if the browser blocks local storage.
}
applyPanelTheme(savedPanelTheme);

document.addEventListener('DOMContentLoaded', () => {
  const headerTrigger = document.querySelector('#toggle-theme-btn');
  const headerPalette = document.querySelector('#theme-palette');
  const loginTrigger = document.querySelector('#signin-theme-trigger');
  const loginPalette = document.querySelector('#signin-theme-palette');
  const paletteControls = [
    [headerTrigger, headerPalette],
    [loginTrigger, loginPalette],
  ].filter(([trigger, palette]) => trigger && palette);
  const setPaletteExpanded = (trigger, palette, expanded) => {
    palette.hidden = !expanded;
    trigger.setAttribute('aria-expanded', String(expanded));
  };
  const closeAllPalettes = () => {
    paletteControls.forEach(([trigger, palette]) => setPaletteExpanded(trigger, palette, false));
  };

  closeAllPalettes();

  document.querySelectorAll('.panel-theme-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const themeName = swatch.dataset.panelTheme;
      applyPanelTheme(themeName);
      try {
        localStorage.setItem('dtmod-panel-theme', themeName);
      } catch (_) {
        // The selected theme still applies to this page if storage is unavailable.
      }

      if (headerPalette && headerTrigger) {
        headerPalette.hidden = true;
        headerTrigger.setAttribute('aria-expanded', 'false');
      }
      if (loginPalette && loginTrigger) {
        loginPalette.hidden = true;
        loginTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  paletteControls.forEach(([trigger, palette]) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setPaletteExpanded(trigger, palette, palette.hidden);
    });
  });

  if (paletteControls.length) {
    document.addEventListener('click', (event) => {
      paletteControls.forEach(([trigger, palette]) => {
        if (!palette.contains(event.target) && !trigger.contains(event.target)) {
          setPaletteExpanded(trigger, palette, false);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAllPalettes();
    });
  }
});
