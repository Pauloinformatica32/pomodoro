/* Theme registry and controller. Loaded before CSS to avoid a theme flash.
 * Future themes need a registry entry, translated names/actions, and a CSS
 * :root[data-theme="id"] block overriding the existing color variables.
 */
(() => {
  const STORAGE_KEY = 'pomodoro.theme.v1';
  const themes = Object.freeze([
    Object.freeze({ id: 'dark', nameKey: 'appearance.dark', actionKey: 'theme.dark', icon: '☾' }),
    Object.freeze({ id: 'light', nameKey: 'appearance.light', actionKey: 'theme.light', icon: '☀' }),
  ]);

  let currentTheme;
  let controlsReady = false;
  let storageFailed = false;

  function initialTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (themes.some((theme) => theme.id === saved)) return saved;
    } catch { /* Use the system preference if storage is unavailable. */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light' : 'dark';
  }

  function nextTheme() {
    const index = themes.findIndex((theme) => theme.id === currentTheme);
    return themes[(index + 1) % themes.length];
  }

  function updateControls() {
    if (!controlsReady) return;
    const { t } = window.PomodoroI18n;
    const next = nextTheme();
    const button = document.getElementById('themeBtn');
    button.textContent = next.icon;
    button.title = t(next.actionKey);
    button.setAttribute('aria-label', t(next.actionKey));
    document.querySelectorAll('#themeOptions input').forEach((radio) => {
      radio.checked = radio.value === currentTheme;
      radio.closest('.theme-option').classList.toggle('is-selected', radio.checked);
    });
    document.getElementById('themeError').hidden = !storageFailed;
  }

  function applyTheme(id, persist = true) {
    if (!themes.some((theme) => theme.id === id)) return false;
    currentTheme = id;
    document.documentElement.setAttribute('data-theme', id);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, id);
        storageFailed = false;
      } catch {
        // Keep the selected appearance usable even if persistence is blocked.
        storageFailed = true;
      }
    }
    updateControls();
    return true;
  }

  // Bootstrap uses the same application path without overwriting saved data.
  applyTheme(initialTheme(), false);

  window.PomodoroThemes = Object.freeze({
    themes,
    getTheme: () => currentTheme,
    setTheme: (id) => applyTheme(id),
    toggle: () => applyTheme(nextTheme().id),
  });

  document.addEventListener('DOMContentLoaded', () => {
    const options = document.getElementById('themeOptions');
    themes.forEach((theme) => {
      const label = document.createElement('label');
      label.className = 'theme-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'appearance-theme';
      radio.value = theme.id;
      const name = document.createElement('span');
      name.dataset.i18n = theme.nameKey;
      name.textContent = window.PomodoroI18n.t(theme.nameKey);
      radio.addEventListener('change', () => {
        if (radio.checked) applyTheme(theme.id);
      });
      label.append(radio, name);
      options.appendChild(label);
    });
    controlsReady = true;
    document.getElementById('themeBtn').addEventListener('click', window.PomodoroThemes.toggle);
    updateControls();
  });

  // Language changes refresh labels only; they never apply or save a theme.
  document.addEventListener('pomodoro:languagechange', updateControls);
})();
