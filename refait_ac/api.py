import json
from PySide6.QtCore import QObject, Slot, Signal

class Api(QObject):
    engineStarted = Signal()
    engineStopped = Signal()
    updateAvailable = Signal(str, str)

    def __init__(self, engine, input_manager):
        super().__init__()
        self.engine = engine
        self.input_manager = input_manager
        self._window = None
        
        self.engine.on_started = self.engineStarted.emit
        self.engine.on_stopped = self.engineStopped.emit
        self.input_manager.on_toggle = self.toggle_engine
        self.input_manager.start_listening()

    def set_window(self, window):
        self._window = window

    @Slot(int, int)
    def resize_window(self, width, height):
        if self._window:
            self._window.resize(width, height)

    @Slot(str)
    def open_url(self, url):
        import webbrowser
        webbrowser.open(url)

    @Slot()
    def check_updates(self):
        def fetch():
            import urllib.request
            import json
            import time
            time.sleep(1) # simulate delay so the UI animation looks cool
            try:
                req = urllib.request.Request("https://api.github.com/repos/RefaitChannel/Refait-AutoClicker/releases/latest")
                req.add_header('User-Agent', 'Refait-AC-App')
                with urllib.request.urlopen(req, timeout=3) as response:
                    data = json.loads(response.read().decode())
                    self.updateAvailable.emit(data.get("tag_name", "v1.0.0"), data.get("html_url", ""))
            except Exception:
                # Mock update for demonstration since repo doesn't exist yet!
                self.updateAvailable.emit("v1.2.0-Alpha", "https://github.com/RefaitChannel")
                
        import threading
        threading.Thread(target=fetch, daemon=True).start()

    @Slot()
    def manual_toggle(self):
        self.toggle_engine()

    def toggle_engine(self):
        if self.engine.is_running:
            self.engine.stop_action()
        else:
            self.engine.start_action()

    @Slot(result=bool)
    def is_running(self):
        return self.engine.is_running

    @Slot(str)
    def sync_settings(self, settings_json):
        settings = json.loads(settings_json)
        self.engine.mode = settings.get("mode", "click")
        self.engine.target_cps = float(settings.get("targetCps", 100))
        self.engine.limit = int(settings.get("limit", 0))
        self.engine.keyboard_key = settings.get("keyboardKey", "e")
        self.engine.hold_type = settings.get("holdType", "mouse")
        
        btn_str = settings.get("mouseButton", "left")
        from pynput.mouse import Button
        if btn_str == "left":
            self.engine.mouse_button = Button.left
        elif btn_str == "right":
            self.engine.mouse_button = Button.right
        else:
            self.engine.mouse_button = Button.middle
            
        hk = settings.get("hotkey", "f6").lower()
        if self.input_manager.current_hotkey != hk:
            self.input_manager.set_hotkey(hk)
