"""UI regression checks using Chrome and Python's standard library only.

Run with Python 3. Screenshots and the isolated browser profile use a temp folder.
The test never reads or changes the user's browser data.
"""
import base64
import contextlib
import functools
import http.server
import json
import os
import re
from pathlib import Path
import shutil
import socket
import struct
import subprocess
import tempfile
import threading
import time
import urllib.request


class CDP:
    """Small WebSocket client for Chrome's local debugging protocol."""

    def __init__(self, url):
        from urllib.parse import urlsplit
        target = urlsplit(url)
        self.socket = socket.create_connection((target.hostname, target.port), 10)
        self.socket.settimeout(15)
        key = base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall((f'GET {target.path} HTTP/1.1\r\nHost: {target.netloc}\r\n'
                             f'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                             f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        response = b''
        while not response.endswith(b'\r\n\r\n'):
            response += self.socket.recv(1)
        assert b'101' in response, response
        self.sequence = 0

    def read(self, count):
        data = b''
        while len(data) < count:
            chunk = self.socket.recv(count - len(data))
            if not chunk:
                raise ConnectionError('Chrome closed its debugging connection')
            data += chunk
        return data

    def call(self, method, params=None):
        self.sequence += 1
        payload = json.dumps(dict(id=self.sequence, method=method, params=params or {})).encode()
        size = len(payload)
        header = bytes([129, 128 | size]) if size < 126 else bytes([129, 254]) + struct.pack('!H', size)
        mask = os.urandom(4)
        self.socket.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
        while True:
            first, second = self.read(2)
            length = second & 127
            if length == 126:
                length = struct.unpack('!H', self.read(2))[0]
            elif length == 127:
                length = struct.unpack('!Q', self.read(8))[0]
            message = json.loads(self.read(length))
            if message.get('id') == self.sequence:
                assert 'error' not in message, message
                return message.get('result', {})

    def js(self, expression):
        result = self.call('Runtime.evaluate', dict(expression=expression, returnByValue=True))
        assert 'exceptionDetails' not in result, result
        return result['result'].get('value')


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    root = Path(__file__).resolve().parents[1]
    # Catch missing dictionary entries instead of silently accepting fallback text.
    catalogs = (root / 'js/i18n.js').read_text(encoding='utf-8')
    sections = re.split(r"    (?:'pt-BR'|en|es): \{", catalogs)[1:]
    keys = [set(re.findall(r"^      '([^']+)':", section, re.M)) for section in sections]
    assert len(keys) == 3 and keys[0] == keys[1] == keys[2], 'Incomplete translation dictionary'
    html = (root / 'index.html').read_text(encoding='utf-8')
    marked_keys = set(re.findall(r'data-i18n(?:-[\w-]+)?="([^"]+)"', html))
    assert marked_keys <= keys[0], f'Unknown HTML translation keys: {marked_keys - keys[0]}'
    chrome = shutil.which('chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    artifacts = Path(tempfile.mkdtemp(prefix='pomodoro-ui-'))
    handler = functools.partial(QuietHandler, directory=str(root))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        debug_port = probe.getsockname()[1]
    process = subprocess.Popen([chrome, '--headless=new', '--disable-gpu', '--no-first-run',
                                '--no-default-browser-check', '--disable-extensions',
                                f'--user-data-dir={artifacts / "profile"}',
                                f'--remote-debugging-port={debug_port}', 'about:blank'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    client = None
    try:
        for attempt in range(100):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{debug_port}/json', timeout=1) as response:
                    pages = json.load(response)
                if pages:
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Chrome debugging did not start')
        client = CDP(next(p for p in pages if p['type'] == 'page')['webSocketDebuggerUrl'])
        client.call('Page.enable')
        # Deterministic time lets us check full cycles without waiting 25 minutes.
        client.call('Page.addScriptToEvaluateOnNewDocument', {'source': '''
          window.uiErrors = [];
          addEventListener('error', e => uiErrors.push(e.message));
          addEventListener('unhandledrejection', e => uiErrors.push(String(e.reason)));
          const browserLanguage = new URLSearchParams(location.search).get('browserLanguage') || 'en-US';
          Object.defineProperty(navigator, 'language', { value: browserLanguage });
          Object.defineProperty(navigator, 'languages', { value: [browserLanguage] });
          window.setInterval = fn => { window.uiTick = fn; return 1; };
          window.clearInterval = () => { window.uiTick = null; };
          window.uiNotifications = 0;
          window.uiMessages = [];
          window.uiAudioContexts = 0;
          const NativeAudioContext = window.AudioContext;
          window.AudioContext = class extends NativeAudioContext {
            constructor() { super(); window.uiAudioContexts++; }
          };
          window.Notification = class {
            static permission = 'granted';
            constructor(title, options) { window.uiNotifications++; window.uiMessages.push({ title, ...options }); }
          };
        '''})
        client.call('Emulation.setDeviceMetricsOverride', dict(width=1440, height=1000, deviceScaleFactor=1, mobile=False))
        client.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/index.html'})
        for _ in range(100):
            if client.js('document.readyState === "complete" && !!document.getElementById("timeDisplay")'):
                break
            time.sleep(.05)
        client.js('window.$ = id => document.getElementById(id)')
        assert client.js('$("timeDisplay").textContent') == '25:00'
        client.js('document.documentElement.setAttribute("data-theme", "dark")')

        def capture(name):
            # Let theme transitions settle before checking the final appearance.
            time.sleep(.35)
            image = client.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': True})
            (artifacts / name).write_bytes(base64.b64decode(image['data']))

        capture('desktop-dark.png')
        client.js('$("startPauseBtn").click(); uiTick()')
        assert client.js('$("timeDisplay").textContent') == '24:59'
        assert client.js('document.documentElement.dataset.running') == 'true'
        client.js('$("startPauseBtn").click()')
        assert client.js('$("sessionStatus").textContent') == 'Session paused'
        client.js('$("resetBtn").click()')
        assert client.js('$("timeDisplay").textContent') == '25:00'
        for mode, duration in [('short', '05:00'), ('long', '15:00'), ('focus', '25:00')]:
            client.js(f'document.querySelector(\'[data-mode="{mode}"]\').click()')
            assert client.js('$("timeDisplay").textContent') == duration
        client.js('$("skipBtn").click()')
        assert client.js('document.querySelector(".mode-btn.active").dataset.mode') == 'short'
        client.js('$("skipBtn").click(); $("settingsBtn").click()')
        assert client.js('document.activeElement.id') == 'closeSettingsBtn'
        assert client.js('document.querySelector(".app").inert')
        client.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Tab', 'code': 'Tab', 'windowsVirtualKeyCode': 9, 'modifiers': 8})
        assert client.js('document.activeElement.id') == 'saveSettingsBtn'
        client.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Tab', 'code': 'Tab', 'windowsVirtualKeyCode': 9})
        assert client.js('document.activeElement.id') == 'closeSettingsBtn'
        client.js('$("focusInput").value=1; $("shortInput").value=1; $("longInput").value=1; $("cyclesInput").value=2; $("autoStartInput").checked=true; $("soundInput").checked=false; $("saveSettingsBtn").click()')
        assert client.js('$("timeDisplay").textContent') == '01:00'
        assert not client.js('document.querySelector(".app").inert')
        client.js('$("startPauseBtn").click(); for(let i=0;i<60;i++) uiTick()')
        assert client.js('$("pomodoroCount").textContent') == '1'
        assert client.js('document.querySelector(".mode-btn.active").dataset.mode') == 'short'
        assert client.js('document.documentElement.dataset.running') == 'true'
        client.js('for(let i=0;i<120;i++) uiTick()')
        assert client.js('$("pomodoroCount").textContent') == '2'
        assert client.js('document.querySelector(".mode-btn.active").dataset.mode') == 'long'
        assert client.js('uiNotifications') == 3
        assert client.js('uiAudioContexts') == 0
        client.js('$("startPauseBtn").click(); $("taskInput").value="Prepare presentation"; $("taskForm").requestSubmit()')
        assert client.js('document.querySelectorAll(".task-item").length') == 1
        client.js('document.querySelector(".task-item input").click()')
        assert client.js('document.querySelector(".task-item").classList.contains("done")')
        client.js('$("taskInput").value="A".repeat(120); $("taskForm").requestSubmit()')
        for width, height in [(1440, 1000), (810, 900), (768, 1024), (390, 844), (320, 568), (280, 640), (844, 390)]:
            client.call('Emulation.setDeviceMetricsOverride', dict(width=width, height=height, deviceScaleFactor=1, mobile=False))
            assert client.js('document.documentElement.scrollWidth <= innerWidth'), f'Overflow at {width}'
            assert client.js('$("startPauseBtn").getBoundingClientRect().width >= 100')
            client.js('$("settingsBtn").click()')
            assert client.js('document.querySelector(".settings-panel").getBoundingClientRect().top >= 0')
            assert client.js('document.querySelector(".settings-panel").getBoundingClientRect().bottom <= innerHeight')
            client.js('$("saveSettingsBtn").scrollIntoView()')
            assert client.js('$("saveSettingsBtn").getBoundingClientRect().bottom <= innerHeight')
            client.js('$("closeSettingsBtn").click()')
        client.call('Emulation.setDeviceMetricsOverride', dict(width=390, height=844, deviceScaleFactor=1, mobile=False))
        capture('mobile-dark.png')
        client.js('$("themeBtn").click()')
        assert client.js('localStorage.getItem("pomodoro.theme.v1")') == 'light'
        capture('mobile-light.png')
        client.call('Page.reload')
        time.sleep(.3)
        assert client.js('document.documentElement.dataset.theme') == 'light'
        assert client.js('document.querySelectorAll(".task-item").length') == 2
        assert client.js('document.querySelector(".task-item").classList.contains("done")')
        assert client.js('document.getElementById("pomodoroCount").textContent') == '2'
        assert client.js('document.getElementById("timeDisplay").textContent') == '01:00'
        client.js('document.querySelector(".task-delete").click()')
        assert client.js('JSON.parse(localStorage.getItem("pomodoro.tasks.v1")).length') == 1
        client.call('Emulation.setDeviceMetricsOverride', dict(width=1440, height=1000, deviceScaleFactor=1, mobile=False))
        capture('desktop-light.png')
        client.js('document.getElementById("settingsBtn").click()')
        client.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
        assert client.js('document.getElementById("settingsOverlay").classList.contains("hidden")')

        # Language changes must preserve the running session, DOM and unsaved edits.
        client.js('window.$ = id => document.getElementById(id); window.noReload = {}; window.marker = noReload; $("taskInput").value="Estudar — Study — Estudiar <b>literal</b>"; $("taskForm").requestSubmit(); $("taskInput").value="Unsaved task"; $("startPauseBtn").click(); uiTick(); $("settingsBtn").click(); $("focusInput").value=37; document.querySelector(".language-picker summary").click()')
        saved = client.js('Object.fromEntries(["pomodoro.settings.v1", "pomodoro.tasks.v1", "pomodoro.state.v1", "pomodoro.theme.v1"].map(key => [key, localStorage.getItem(key)]))')
        clock = client.js('$("timeDisplay").textContent')
        progress = client.js('$("ringFg").style.strokeDashoffset')
        client.js('window.originalTaskNode = document.querySelector(".task-item")')
        expected = {
            'pt-BR': ('Iniciar', 'Pausar', 'Sessão em andamento', 'Sessão pausada', 'Hora de focar', 'Suas tarefas', 'Reiniciar sessão', 'Sessão de foco concluída', 'Hora de fazer uma pausa 🎉'),
            'en': ('Start', 'Pause', 'Session in progress', 'Session paused', 'Focus time', 'Your tasks', 'Reset session', 'Focus time finished', 'Time for a break 🎉'),
            'es': ('Iniciar', 'Pausar', 'Sesión en curso', 'Sesión en pausa', 'Hora de concentrarse', 'Tus tareas', 'Reiniciar sesión', 'Sesión de concentración finalizada', 'Hora de descansar 🎉'),
        }
        for locale, labels in expected.items():
            client.js(f'document.querySelector(\'[data-language="{locale}"]\').click()')
            assert client.js('document.documentElement.lang') == locale
            assert client.js('localStorage.getItem("pomodoro.language.v1")') == locale
            assert client.js('document.querySelector("[data-language][aria-pressed=true]").dataset.language') == locale
            assert client.js('document.querySelectorAll("[data-language][aria-pressed=true]").length') == 1
            assert client.js('noReload === marker && originalTaskNode === document.querySelector(".task-item")')
            assert client.js('$("timeDisplay").textContent') == clock
            assert client.js('$("ringFg").style.strokeDashoffset') == progress
            assert client.js('$("startPauseBtn").textContent') == labels[1]
            assert client.js('$("sessionStatus").textContent') == labels[2]
            assert client.js('$("sessionLabel").textContent') == labels[4]
            assert labels[4] in client.js('document.title')
            assert client.js('$("tasksHeading").textContent') == labels[5]
            assert client.js('$("resetBtn").title') == labels[6]
            assert client.js('$("focusInput").value') == '37'
            assert client.js('$("taskInput").value') == 'Unsaved task'
            assert client.js('document.querySelectorAll(".task-text")[1].textContent') == 'Estudar — Study — Estudiar <b>literal</b>'
            assert client.js('document.querySelectorAll(".task-item input")[1].getAttribute("aria-label")').endswith('Estudar — Study — Estudiar <b>literal</b>')
            assert client.js('Object.fromEntries(Object.keys(' + json.dumps(saved) + ').map(key => [key, localStorage.getItem(key)]))') == saved
            assert client.js('Array.from(document.querySelectorAll("[data-i18n]")).every(node => node.textContent === PomodoroI18n.t(node.dataset.i18n))')
            for attribute in ['aria-label', 'title', 'placeholder', 'content']:
                assert client.js(f'Array.from(document.querySelectorAll("[data-i18n-{attribute}]")).every(node => node.getAttribute("{attribute}") === PomodoroI18n.t(node.getAttribute("data-i18n-{attribute}")))')

            # Verify all translated strings in both themes and at narrow/landscape sizes.
            for theme in ['dark', 'light']:
                client.js(f'document.documentElement.dataset.theme="{theme}"')
                for width, height in [(1440, 1000), (810, 900), (390, 844), (320, 568), (280, 640), (844, 390)]:
                    client.call('Emulation.setDeviceMetricsOverride', dict(width=width, height=height, deviceScaleFactor=1, mobile=False))
                    assert client.js('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), f'{locale}: page overflow at {width}'
                    assert client.js('document.querySelector(".settings-panel").scrollWidth <= document.querySelector(".settings-panel").clientWidth'), f'{locale}: dialog overflow at {width}'
                    assert client.js('Array.from(document.querySelectorAll(".mode-btn, .language-option, .language-summary, .settings-header h2, .brand h1")).every(node => node.scrollWidth <= node.clientWidth + 1)'), f'{locale}: clipped text at {width}'
                    assert client.js('document.querySelector(".brand").getBoundingClientRect().right <= document.querySelector(".header-actions").getBoundingClientRect().left'), f'{locale}: overlapping header at {width}'
                    assert client.js('document.querySelector(".header-actions").getBoundingClientRect().right <= document.querySelector(".header").getBoundingClientRect().right + 1'), f'{locale}: overflowing header at {width}'
                    assert client.js('Array.from(document.querySelectorAll(".panel-heading")).every(row => { const items = Array.from(row.children).filter(node => node.getClientRects().length); return items.length < 2 || items[0].getBoundingClientRect().right <= items[1].getBoundingClientRect().left; })'), f'{locale}: overlapping panel labels at {width}'
                    client.js('$("closeSettingsBtn").click()')
                    assert client.js('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), f'{locale}: page overflow with dialog closed at {width}'
                    assert client.js('document.querySelector(".header-actions").getBoundingClientRect().right <= document.querySelector(".header").getBoundingClientRect().right + 1'), f'{locale}: header overflow with dialog closed at {width}'
                    client.js('$("settingsBtn").click(); $("focusInput").value=37')
                client.call('Emulation.setDeviceMetricsOverride', dict(width=390, height=844, deviceScaleFactor=1, mobile=False))
                client.js('document.querySelector(".language-picker").scrollIntoView({block:"center"})')
                capture(f'language-{locale}-{theme}.png')
            client.js('$("closeSettingsBtn").click(); scrollTo(0, 0)')
            capture(f'page-{locale}-mobile.png')
            client.js('$("settingsBtn").click()')
            client.js('$("closeSettingsBtn").click(); $("startPauseBtn").click()')
            assert client.js('$("sessionStatus").textContent') == labels[3]
            assert client.js('$("startPauseBtn").textContent') == labels[0]
            client.js('$("startPauseBtn").click(); $("settingsBtn").click(); $("focusInput").value=37')

        # Finish a session in each language and check notification text, counters,
        # new tasks, and paused/ready states after changing locale.
        client.js('$("closeSettingsBtn").click()')
        for locale, labels in expected.items():
            client.js(f'PomodoroI18n.setLanguage("{locale}"); $("resetBtn").click(); document.querySelector(\'[data-mode="focus"]\').click(); $("startPauseBtn").click(); for(let i=0;i<60;i++) uiTick()')
            assert client.js('uiMessages[uiMessages.length - 1].title') == labels[7]
            assert client.js('uiMessages[uiMessages.length - 1].body') == labels[8]
            client.js('$("startPauseBtn").click()')
            count = client.js('$("pomodoroCount").textContent')
            client.call('Page.reload')
            time.sleep(.2)
            client.js('window.$ = id => document.getElementById(id)')
            assert client.js('document.documentElement.lang') == locale
            assert client.js('$("pomodoroCount").textContent') == count
            assert client.js('document.querySelectorAll(".task-item").length') == 2
            assert client.js('$("startPauseBtn").textContent') == labels[0]
            assert client.js('uiErrors') == []

        # Storage failures should apply the language and report a translated error.
        client.js('window.nativeSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if(key === "pomodoro.language.v1") throw new Error("Blocked for test"); return nativeSetItem.call(this, key, value); }; PomodoroI18n.setLanguage("pt-BR")')
        assert client.js('document.documentElement.lang') == 'pt-BR'
        assert not client.js('$("languageError").hidden')
        assert 'não foi possível salvar' in client.js('$("languageError").textContent')
        client.js('Storage.prototype.setItem = nativeSetItem; PomodoroI18n.setLanguage("en")')
        assert client.js('$("languageError").hidden')

        # No preference: primary browser language, regional variants, or pt-BR fallback.
        for browser, locale in [('pt-PT', 'pt-BR'), ('en-GB', 'en'), ('es-MX', 'es'), ('fr-FR', 'pt-BR')]:
            client.js('localStorage.removeItem("pomodoro.language.v1")')
            client.call('Page.navigate', {'url': f'http://127.0.0.1:{server.server_port}/index.html?browserLanguage={browser}'})
            time.sleep(.2)
            client.js('window.$ = id => document.getElementById(id)')
            assert client.js('document.documentElement.lang') == locale
            assert client.js('document.querySelectorAll(".task-item").length') == 2
            assert client.js('uiErrors') == []
        client.js('localStorage.setItem("pomodoro.language.v1", "invalid"); location.reload()')
        time.sleep(.2)
        assert client.js('document.documentElement.lang') == 'pt-BR'
        # Empty-state text is also dynamic, and task deletion still persists.
        client.js('window.$ = id => document.getElementById(id); document.querySelectorAll(".task-delete").forEach(button => button.click())')
        for locale in expected:
            client.js(f'PomodoroI18n.setLanguage("{locale}")')
            assert client.js('document.querySelector(".task-empty").textContent === PomodoroI18n.t("tasks.empty")')
        assert client.js('JSON.parse(localStorage.getItem("pomodoro.tasks.v1")).length') == 0

        client.js('document.getElementById("settingsBtn").click(); document.getElementById("soundInput").checked=true; document.getElementById("autoStartInput").checked=false; document.getElementById("saveSettingsBtn").click(); document.getElementById("startPauseBtn").click(); for(let i=0;i<60;i++) uiTick()')
        assert client.js('uiAudioContexts') == 1
        assert client.js('document.documentElement.dataset.running') == 'false'
        assert client.js('uiErrors') == [], client.js('uiErrors')
        print('PASS: all 3 languages, browser detection/fallback, live switching, localized notifications/ARIA/dynamic text, persistence, preserved drafts/data, storage failure, themes, responsive layout, timer regression, tasks, sound, and dialog keyboard navigation.')
        print(f'Screenshots: {artifacts}')
    finally:
        if client:
            with contextlib.suppress(Exception):
                client.call('Browser.close')
            client.socket.close()
        with contextlib.suppress(subprocess.TimeoutExpired):
            process.wait(timeout=5)
        if process.poll() is None:
            process.terminate()
        server.shutdown()


if __name__ == '__main__':
    main()
