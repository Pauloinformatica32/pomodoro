/* Small, dependency-free i18n layer. User-created task text is never translated. */
(() => {
  const STORAGE_KEY = 'pomodoro.language.v1';
  const FALLBACK = 'pt-BR';
  const languages = {
    'pt-BR': 'Português (Brasil)',
    en: 'English',
    es: 'Español',
  };

  // Every locale uses the same keys. Text and attributes are assigned safely,
  // without innerHTML, including messages that contain a user's task name.
  const translations = {
    'pt-BR': {
      'app.name': 'Temporizador Pomodoro',
      'app.description': 'Um espaço tranquilo para se concentrar, com temporizador Pomodoro, tarefas e pausas no seu ritmo.',
      'brand.subtitle': 'Um pouco de estrutura. Muito mais foco.',
      'intro.eyebrow': 'MENOS DISTRAÇÃO, MAIS INTENÇÃO',
      'intro.title': 'Abra espaço para',
      'intro.highlight': 'se concentrar.',
      'intro.description': 'Escolha uma tarefa. Encontre seu ritmo. Respire.',
      'timer.region': 'Temporizador da sessão',
      'timer.heading': 'Seu espaço de foco',
      'timer.modeGroup': 'Modo da sessão',
      'mode.focus': 'Foco',
      'mode.short': 'Pausa curta',
      'mode.long': 'Pausa longa',
      'session.focus': 'Hora de focar',
      'session.short': 'Pausa curta',
      'session.long': 'Pausa longa',
      'timer.remaining': 'Tempo restante',
      'timer.mantra': 'UMA COISA DE CADA VEZ',
      'timer.start': 'Iniciar',
      'timer.pause': 'Pausar',
      'timer.reset': 'Reiniciar sessão',
      'timer.skip': 'Pular sessão',
      'timer.note': 'Pequenos passos. Progresso de verdade.',
      'status.ready': 'Tudo pronto para começar',
      'status.running': 'Sessão em andamento',
      'status.paused': 'Sessão pausada',
      'theme.light': 'Mudar para o tema claro',
      'theme.dark': 'Mudar para o tema escuro',
      'appearance.heading': 'Aparência',
      'appearance.description': 'Escolha um tema. A mudança é imediata e salva automaticamente.',
      'appearance.dark': 'Escuro',
      'appearance.light': 'Claro',
      'appearance.error': 'O tema foi aplicado, mas não foi possível salvar sua preferência neste navegador.',
      'tasks.region': 'Tarefas e progresso diário',
      'tasks.heading': 'Suas tarefas',
      'tasks.tag': 'UMA DE CADA VEZ',
      'tasks.description': 'Organize as ideias. Defina seu próximo passo.',
      'tasks.new': 'Nova tarefa',
      'tasks.placeholder': 'O que precisa da sua atenção?',
      'tasks.add': 'Adicionar tarefa',
      'tasks.empty': 'Nenhuma tarefa ainda — adicione a primeira!',
      'tasks.complete': 'Marcar tarefa como concluída: {task}',
      'tasks.incomplete': 'Marcar tarefa como pendente: {task}',
      'tasks.delete': 'Excluir tarefa: {task}',
      'progress.heading': 'Um pouco melhor a cada dia',
      'progress.completed': 'Pomodoros concluídos',
      'progress.caption': 'Sessões de foco de hoje',
      'progress.cycle': 'Ciclo atual',
      'progress.cycleLabel': 'Progresso do ciclo',
      'progress.note': 'Foco é prática, não uma linha de chegada.',
      'footer': 'Um jeito mais tranquilo de realizar suas tarefas.',
      'settings.open': 'Configurações',
      'settings.eyebrow': 'DO SEU JEITO',
      'settings.heading': 'Seu ritmo',
      'settings.close': 'Fechar configurações',
      'settings.description': 'Escolha um ritmo que funcione para você.',
      'settings.durations': 'Duração das sessões',
      'settings.focus': 'Foco (min)',
      'settings.short': 'Pausa curta (min)',
      'settings.long': 'Pausa longa (min)',
      'settings.cycles': 'Pomodoros antes da pausa longa',
      'settings.preferences': 'Preferências',
      'settings.autoStart': 'Iniciar próxima sessão automaticamente',
      'settings.sound': 'Som ao concluir',
      'settings.hint': 'Salvar reinicia a sessão atual com suas configurações.',
      'settings.save': 'Salvar configurações',
      'language.label': 'Idioma / Language',
      'language.description': 'A mudança é imediata e salva automaticamente.',
      'language.options': 'Escolher idioma',
      'language.error': 'O idioma foi aplicado, mas não foi possível salvar sua preferência neste navegador.',
      'notification.focus': 'Sessão de foco concluída',
      'notification.short': 'Pausa curta concluída',
      'notification.long': 'Pausa longa concluída',
      'notification.break': 'Hora de fazer uma pausa 🎉',
      'notification.work': 'Hora de voltar ao trabalho 💪',
    },
    en: {
      'app.name': 'Pomodoro Timer',
      'app.description': 'A calmer space for focused work, with a Pomodoro timer, tasks and breaks at your own pace.',
      'brand.subtitle': 'A little structure. A lot more focus.',
      'intro.eyebrow': 'LESS DISTRACTION, MORE INTENTION',
      'intro.title': 'Make room for',
      'intro.highlight': 'deep work.',
      'intro.description': 'Choose a task. Find your rhythm. Take a breath.',
      'timer.region': 'Session timer',
      'timer.heading': 'Your focus space',
      'timer.modeGroup': 'Session mode',
      'mode.focus': 'Focus',
      'mode.short': 'Short Break',
      'mode.long': 'Long Break',
      'session.focus': 'Focus time',
      'session.short': 'Short break',
      'session.long': 'Long break',
      'timer.remaining': 'Time remaining',
      'timer.mantra': 'ONE THING AT A TIME',
      'timer.start': 'Start',
      'timer.pause': 'Pause',
      'timer.reset': 'Reset session',
      'timer.skip': 'Skip session',
      'timer.note': 'Small steps. Meaningful progress.',
      'status.ready': 'Ready when you are',
      'status.running': 'Session in progress',
      'status.paused': 'Session paused',
      'theme.light': 'Switch to light theme',
      'theme.dark': 'Switch to dark theme',
      'appearance.heading': 'Appearance',
      'appearance.description': 'Choose a theme. Changes apply instantly and save automatically.',
      'appearance.dark': 'Dark',
      'appearance.light': 'Light',
      'appearance.error': 'The theme was applied, but your preference could not be saved in this browser.',
      'tasks.region': 'Tasks and daily progress',
      'tasks.heading': 'Your tasks',
      'tasks.tag': 'ONE AT A TIME',
      'tasks.description': 'Clear your mind. Give your next step a name.',
      'tasks.new': 'New task',
      'tasks.placeholder': 'What needs your focus?',
      'tasks.add': 'Add task',
      'tasks.empty': 'No tasks yet — add your first one!',
      'tasks.complete': 'Mark task as completed: {task}',
      'tasks.incomplete': 'Mark task as incomplete: {task}',
      'tasks.delete': 'Delete task: {task}',
      'progress.heading': 'A little better, every day',
      'progress.completed': 'Pomodoros completed',
      'progress.caption': 'Today’s focused sessions',
      'progress.cycle': 'Current cycle',
      'progress.cycleLabel': 'Cycle progress',
      'progress.note': 'Focus is a practice, not a finish line.',
      'footer': 'A calmer way to get things done.',
      'settings.open': 'Settings',
      'settings.eyebrow': 'MAKE IT YOURS',
      'settings.heading': 'Your rhythm',
      'settings.close': 'Close settings',
      'settings.description': 'Set a pace that works for you.',
      'settings.durations': 'Session durations',
      'settings.focus': 'Focus (min)',
      'settings.short': 'Short break (min)',
      'settings.long': 'Long break (min)',
      'settings.cycles': 'Pomodoros before long break',
      'settings.preferences': 'Preferences',
      'settings.autoStart': 'Auto-start next session',
      'settings.sound': 'Sound on completion',
      'settings.hint': 'Saving restarts the current session with your settings.',
      'settings.save': 'Save settings',
      'language.label': 'Language / Idioma',
      'language.description': 'Changes apply instantly and save automatically.',
      'language.options': 'Choose language',
      'language.error': 'The language was applied, but your preference could not be saved in this browser.',
      'notification.focus': 'Focus time finished',
      'notification.short': 'Short break finished',
      'notification.long': 'Long break finished',
      'notification.break': 'Time for a break 🎉',
      'notification.work': 'Time to get back to work 💪',
    },
    es: {
      'app.name': 'Temporizador Pomodoro',
      'app.description': 'Un espacio tranquilo para concentrarte, con temporizador Pomodoro, tareas y descansos a tu ritmo.',
      'brand.subtitle': 'Un poco de estructura. Mucha más concentración.',
      'intro.eyebrow': 'MENOS DISTRACCIÓN, MÁS INTENCIÓN',
      'intro.title': 'Haz espacio para',
      'intro.highlight': 'concentrarte.',
      'intro.description': 'Elige una tarea. Encuentra tu ritmo. Respira.',
      'timer.region': 'Temporizador de la sesión',
      'timer.heading': 'Tu espacio de concentración',
      'timer.modeGroup': 'Modo de sesión',
      'mode.focus': 'Concentración',
      'mode.short': 'Descanso corto',
      'mode.long': 'Descanso largo',
      'session.focus': 'Hora de concentrarse',
      'session.short': 'Descanso corto',
      'session.long': 'Descanso largo',
      'timer.remaining': 'Tiempo restante',
      'timer.mantra': 'UNA COSA A LA VEZ',
      'timer.start': 'Iniciar',
      'timer.pause': 'Pausar',
      'timer.reset': 'Reiniciar sesión',
      'timer.skip': 'Saltar sesión',
      'timer.note': 'Pequeños pasos. Progreso real.',
      'status.ready': 'Todo listo para empezar',
      'status.running': 'Sesión en curso',
      'status.paused': 'Sesión en pausa',
      'theme.light': 'Cambiar al tema claro',
      'theme.dark': 'Cambiar al tema oscuro',
      'appearance.heading': 'Apariencia',
      'appearance.description': 'Elige un tema. El cambio es inmediato y se guarda automáticamente.',
      'appearance.dark': 'Oscuro',
      'appearance.light': 'Claro',
      'appearance.error': 'Se aplicó el tema, pero no se pudo guardar tu preferencia en este navegador.',
      'tasks.region': 'Tareas y progreso diario',
      'tasks.heading': 'Tus tareas',
      'tasks.tag': 'UNA A LA VEZ',
      'tasks.description': 'Ordena tus ideas. Define tu próximo paso.',
      'tasks.new': 'Nueva tarea',
      'tasks.placeholder': '¿Qué necesita tu atención?',
      'tasks.add': 'Añadir tarea',
      'tasks.empty': 'Aún no hay tareas. ¡Añade la primera!',
      'tasks.complete': 'Marcar tarea como completada: {task}',
      'tasks.incomplete': 'Marcar tarea como pendiente: {task}',
      'tasks.delete': 'Eliminar tarea: {task}',
      'progress.heading': 'Un poco mejor cada día',
      'progress.completed': 'Pomodoros completados',
      'progress.caption': 'Sesiones de concentración de hoy',
      'progress.cycle': 'Ciclo actual',
      'progress.cycleLabel': 'Progreso del ciclo',
      'progress.note': 'Concentrarse requiere práctica; no se trata de llegar a una meta.',
      'footer': 'Una forma más tranquila de completar tus tareas.',
      'settings.open': 'Configuración',
      'settings.eyebrow': 'A TU MANERA',
      'settings.heading': 'Tu ritmo',
      'settings.close': 'Cerrar configuración',
      'settings.description': 'Elige un ritmo que funcione para ti.',
      'settings.durations': 'Duración de las sesiones',
      'settings.focus': 'Concentración (min)',
      'settings.short': 'Descanso corto (min)',
      'settings.long': 'Descanso largo (min)',
      'settings.cycles': 'Pomodoros antes del descanso largo',
      'settings.preferences': 'Preferencias',
      'settings.autoStart': 'Iniciar la siguiente sesión automáticamente',
      'settings.sound': 'Sonido al finalizar',
      'settings.hint': 'Guardar reinicia la sesión actual con tu configuración.',
      'settings.save': 'Guardar configuración',
      'language.label': 'Idioma / Language',
      'language.description': 'El cambio es inmediato y se guarda automáticamente.',
      'language.options': 'Elegir idioma',
      'language.error': 'Se aplicó el idioma, pero no se pudo guardar tu preferencia en este navegador.',
      'notification.focus': 'Sesión de concentración finalizada',
      'notification.short': 'Descanso corto finalizado',
      'notification.long': 'Descanso largo finalizado',
      'notification.break': 'Hora de descansar 🎉',
      'notification.work': 'Hora de volver al trabajo 💪',
    },
  };

  function resolveLanguage(value) {
    const base = String(value || '').toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en' || base === 'es') return base;
    return null;
  }

  function initialLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (Object.hasOwn(languages, saved)) return saved;
    } catch { /* A blocked storage must not prevent translation. */ }
    return resolveLanguage(navigator.language || navigator.languages?.[0]) || FALLBACK;
  }

  let language = initialLanguage();

  function t(key, values = {}) {
    const text = translations[language][key] ?? translations[FALLBACK][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  }

  function applyTranslations() {
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    for (const attribute of ['aria-label', 'title', 'placeholder', 'content']) {
      document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => {
        node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
      });
    }
    document.getElementById('currentLanguage').textContent = languages[language];
    document.getElementById('currentLanguage').lang = language;
    document.querySelectorAll('[data-language]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
  }

  function setLanguage(next) {
    if (!Object.hasOwn(languages, next)) return;
    language = next;
    let saved = true;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      saved = false;
    }
    applyTranslations();
    document.getElementById('languageError').hidden = saved;
    document.dispatchEvent(new CustomEvent('pomodoro:languagechange'));
  }

  window.PomodoroI18n = Object.freeze({ t, getLanguage: () => language, setLanguage });
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  });
  applyTranslations();
})();
