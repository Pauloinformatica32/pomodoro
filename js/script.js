(() => {
  const { t } = window.PomodoroI18n;
  const STORAGE_KEY = 'pomodoro.settings.v1';
  const TASKS_KEY = 'pomodoro.tasks.v1';
  const STATE_KEY = 'pomodoro.state.v1';
  const THEME_KEY = 'pomodoro.theme.v1';

  const RING_CIRCUMFERENCE = 2 * Math.PI * 135;

  const defaultSettings = {
    focus: 25,
    short: 5,
    long: 15,
    cycles: 4,
    autoStart: false,
    sound: true,
  };

  const modeColors = {
    focus: 'var(--focus)',
    short: 'var(--short)',
    long: 'var(--long)',
  };

  let settings = loadSettings();
  let tasks = loadTasks();

  let mode = 'focus';
  let secondsLeft = settings.focus * 60;
  let totalSeconds = settings.focus * 60;
  let isRunning = false;
  let intervalId = null;
  let completedToday = loadCompletedCount();

  const el = {
    modeButtons: document.querySelectorAll('.mode-btn'),
    timeDisplay: document.getElementById('timeDisplay'),
    sessionLabel: document.getElementById('sessionLabel'),
    sessionStatus: document.getElementById('sessionStatus'),
    ringFg: document.getElementById('ringFg'),
    startPauseBtn: document.getElementById('startPauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    skipBtn: document.getElementById('skipBtn'),
    themeBtn: document.getElementById('themeBtn'),
    pomodoroCount: document.getElementById('pomodoroCount'),
    pomodoroDots: document.getElementById('pomodoroDots'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    focusInput: document.getElementById('focusInput'),
    shortInput: document.getElementById('shortInput'),
    longInput: document.getElementById('longInput'),
    cyclesInput: document.getElementById('cyclesInput'),
    autoStartInput: document.getElementById('autoStartInput'),
    soundInput: document.getElementById('soundInput'),
    taskForm: document.getElementById('taskForm'),
    taskInput: document.getElementById('taskInput'),
    taskList: document.getElementById('taskList'),
  };

  el.ringFg.style.strokeDasharray = String(RING_CIRCUMFERENCE);

  function updateThemeButton(theme) {
    el.themeBtn.textContent = theme === 'light' ? '☾' : '☀';
    const label = t(theme === 'light' ? 'theme.dark' : 'theme.light');
    el.themeBtn.title = label;
    el.themeBtn.setAttribute('aria-label', label);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeButton(theme);
  }

  updateThemeButton(document.documentElement.getAttribute('data-theme') || 'dark');

  el.themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultSettings };
      return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  function loadCompletedCount() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return 0;
      const data = JSON.parse(raw);
      const today = new Date().toDateString();
      if (data.date !== today) return 0;
      return data.count || 0;
    } catch {
      return 0;
    }
  }

  function saveCompletedCount() {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ date: new Date().toDateString(), count: completedToday })
    );
  }

  function minutesFor(m) {
    return settings[m] * 60;
  }

  function formatTime(totalSecs) {
    const m = Math.floor(totalSecs / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(totalSecs % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateDisplay() {
    el.timeDisplay.textContent = formatTime(secondsLeft);
    el.sessionLabel.textContent = t(`session.${mode}`);
    const progress = totalSeconds === 0 ? 0 : secondsLeft / totalSeconds;
    el.ringFg.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
    document.title = `${formatTime(secondsLeft)} · ${t(`session.${mode}`)}`;
  }

  function setMode(newMode, { resetTimer = true } = {}) {
    mode = newMode;
    document.documentElement.style.setProperty('--accent', modeColors[mode]);
    el.modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    if (resetTimer) {
      pauseTimer();
      totalSeconds = minutesFor(mode);
      secondsLeft = totalSeconds;
      el.sessionStatus.textContent = t('status.ready');
      updateDisplay();
    }
  }

  function renderDots() {
    el.pomodoroCount.textContent = completedToday;
    el.pomodoroDots.innerHTML = '';
    const cycles = settings.cycles;
    const filledInCycle = completedToday % cycles === 0 && completedToday > 0 ? cycles : completedToday % cycles;
    for (let i = 0; i < cycles; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < filledInCycle ? ' filled' : '');
      el.pomodoroDots.appendChild(dot);
    }
  }

  function playChime() {
    if (!settings.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [880, 1108.73].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.4);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch {
      /* audio not available */
    }
  }

  function notify() {
    playChime();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(t(`notification.${mode}`), {
        body: t(mode === 'focus' ? 'notification.break' : 'notification.work'),
      });
    }
  }

  function tick() {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      completeSession();
      return;
    }
    updateDisplay();
  }

  function completeSession() {
    pauseTimer();
    notify();

    if (mode === 'focus') {
      completedToday += 1;
      saveCompletedCount();
      renderDots();
      const nextMode = completedToday % settings.cycles === 0 ? 'long' : 'short';
      setMode(nextMode);
    } else {
      setMode('focus');
    }

    if (settings.autoStart) {
      startTimer();
    }
  }

  function startTimer() {
    if (isRunning) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    isRunning = true;
    document.documentElement.dataset.running = 'true';
    el.sessionStatus.textContent = t('status.running');
    el.startPauseBtn.textContent = t('timer.pause');
    intervalId = setInterval(tick, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    document.documentElement.dataset.running = 'false';
    el.sessionStatus.textContent = t(secondsLeft < totalSeconds && secondsLeft > 0 ? 'status.paused' : 'status.ready');
    el.startPauseBtn.textContent = t('timer.start');
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function toggleTimer() {
    if (isRunning) pauseTimer();
    else startTimer();
  }

  function resetTimer() {
    pauseTimer();
    totalSeconds = minutesFor(mode);
    secondsLeft = totalSeconds;
    el.sessionStatus.textContent = t('status.ready');
    updateDisplay();
  }

  function skipSession() {
    pauseTimer();
    if (mode === 'focus') {
      const nextMode = (completedToday + 1) % settings.cycles === 0 ? 'long' : 'short';
      setMode(nextMode);
    } else {
      setMode('focus');
    }
  }

  el.modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  el.startPauseBtn.addEventListener('click', toggleTimer);
  el.resetBtn.addEventListener('click', resetTimer);
  el.skipBtn.addEventListener('click', skipSession);

  function openSettings() {
    el.focusInput.value = settings.focus;
    el.shortInput.value = settings.short;
    el.longInput.value = settings.long;
    el.cyclesInput.value = settings.cycles;
    el.autoStartInput.checked = settings.autoStart;
    el.soundInput.checked = settings.sound;
    el.settingsOverlay.classList.remove('hidden');
    document.querySelector('.app').inert = true;
    document.body.style.overflow = 'hidden';
    el.closeSettingsBtn.focus();
  }

  function closeSettings() {
    el.settingsOverlay.classList.add('hidden');
    document.querySelector('.app').inert = false;
    document.body.style.overflow = '';
    el.settingsBtn.focus();
  }

  // Keep keyboard navigation inside the open settings dialog.
  el.settingsOverlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
    if (e.key !== 'Tab') return;
    const controls = [...el.settingsOverlay.querySelectorAll('button, input, summary')]
      .filter((control) => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  el.settingsBtn.addEventListener('click', openSettings);
  el.closeSettingsBtn.addEventListener('click', closeSettings);
  el.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === el.settingsOverlay) closeSettings();
  });

  el.saveSettingsBtn.addEventListener('click', () => {
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    settings.focus = clamp(parseInt(el.focusInput.value, 10) || defaultSettings.focus, 1, 120);
    settings.short = clamp(parseInt(el.shortInput.value, 10) || defaultSettings.short, 1, 60);
    settings.long = clamp(parseInt(el.longInput.value, 10) || defaultSettings.long, 1, 90);
    settings.cycles = clamp(parseInt(el.cyclesInput.value, 10) || defaultSettings.cycles, 1, 12);
    settings.autoStart = el.autoStartInput.checked;
    settings.sound = el.soundInput.checked;
    saveSettings();
    renderDots();
    resetTimer();
    closeSettings();
  });

  function renderTasks() {
    el.taskList.innerHTML = '';
    if (tasks.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'task-empty';
      empty.textContent = t('tasks.empty');
      el.taskList.appendChild(empty);
      return;
    }
    tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' done' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.setAttribute('aria-label', t('tasks.complete', { task: task.text }));
      checkbox.addEventListener('change', () => {
        task.done = checkbox.checked;
        saveTasks();
        renderTasks();
      });

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      const del = document.createElement('button');
      del.className = 'task-delete';
      del.textContent = '✕';
      del.setAttribute('aria-label', t('tasks.delete', { task: task.text }));
      del.title = t('tasks.delete', { task: task.text });
      del.addEventListener('click', () => {
        tasks = tasks.filter((t) => t.id !== task.id);
        saveTasks();
        renderTasks();
      });

      li.appendChild(checkbox);
      li.appendChild(text);
      li.appendChild(del);
      el.taskList.appendChild(li);
    });
  }

  el.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = el.taskInput.value.trim();
    if (!value) return;
    tasks.push({ id: Date.now().toString(36), text: value, done: false });
    el.taskInput.value = '';
    saveTasks();
    renderTasks();
  });

  // Refresh only labels: keep time, running state, task DOM, and unsaved inputs.
  function translateDynamicText() {
    updateDisplay();
    updateThemeButton(document.documentElement.getAttribute('data-theme') || 'dark');
    el.startPauseBtn.textContent = t(isRunning ? 'timer.pause' : 'timer.start');
    const status = isRunning ? 'status.running'
      : (secondsLeft < totalSeconds && secondsLeft > 0 ? 'status.paused' : 'status.ready');
    el.sessionStatus.textContent = t(status);
    const empty = el.taskList.querySelector('.task-empty');
    if (empty) empty.textContent = t('tasks.empty');
    el.taskList.querySelectorAll('.task-item').forEach((row) => {
      const task = row.querySelector('.task-text').textContent;
      row.querySelector('input').setAttribute('aria-label', t('tasks.complete', { task }));
      const button = row.querySelector('.task-delete');
      button.setAttribute('aria-label', t('tasks.delete', { task }));
      button.title = t('tasks.delete', { task });
    });
  }

  document.addEventListener('pomodoro:languagechange', translateDynamicText);

  setMode('focus', { resetTimer: false });
  totalSeconds = minutesFor(mode);
  secondsLeft = totalSeconds;
  updateDisplay();
  renderDots();
  renderTasks();
  translateDynamicText();
})();
