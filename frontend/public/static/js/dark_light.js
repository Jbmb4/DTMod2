const PANEL_THEMES = {
  violet: { accent: '#8b5cf6', rgb: '139, 92, 246' },
  sky: { accent: '#38bdf8', rgb: '56, 189, 248' },
  mint: { accent: '#34d399', rgb: '52, 211, 153' },
  orange: { accent: '#e87524', rgb: '232, 117, 36' },
  navy: { accent: '#3b82f6', rgb: '59, 130, 246' },
  pink: { accent: '#d9469a', rgb: '217, 70, 154' },
  teal: { accent: '#14b8a6', rgb: '20, 184, 166' },
  amber: { accent: '#b98a00', rgb: '185, 138, 0' },
};

const applyPanelTheme = (themeName) => {
  const selectedName = Object.prototype.hasOwnProperty.call(PANEL_THEMES, themeName) ? themeName : 'teal';
  const selectedTheme = PANEL_THEMES[selectedName];
  const root = document.documentElement;

  root.dataset.panelTheme = selectedName;
  root.style.setProperty('--panel-accent', selectedTheme.accent);
  root.style.setProperty('--panel-accent-rgb', selectedTheme.rgb);
  root.style.setProperty('--panel-accent-strong', selectedTheme.accent);

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
  // O painel continua usando o tema padrão se o navegador bloquear armazenamento local.
}
applyPanelTheme(savedPanelTheme);

document.addEventListener('DOMContentLoaded', () => {
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

  palette.querySelectorAll('.panel-theme-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const themeName = swatch.dataset.panelTheme;
      applyPanelTheme(themeName);
      try {
        localStorage.setItem('dtmod-panel-theme', themeName);
      } catch (_) {
        // A seleção permanece ativa nesta página mesmo sem armazenamento local.
      }
      closePalette();
      trigger.focus();
    });
  });

  document.addEventListener('click', (event) => {
    if (!palette.contains(event.target) && !trigger.contains(event.target)) closePalette();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePalette();
  });
});
