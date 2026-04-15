import keyboard
import threading

class HotkeyManager:
    def __init__(self):
        self.current_hotkey = "f6"
        self._hooked = False
        self.on_toggle = None

    def set_hotkey(self, new_hotkey):
        if self._hooked:
            self.stop_listening()
        self.current_hotkey = new_hotkey
    
    def start_listening(self):
        if not self._hooked and self.current_hotkey:
            try:
                keyboard.add_hotkey(self.current_hotkey, self._on_hotkey)
                self._hooked = True
            except Exception as e:
                pass

    def stop_listening(self):
        if self._hooked:
            try:
                keyboard.remove_hotkey(self._on_hotkey)
            except Exception:
                pass
            self._hooked = False

    def _on_hotkey(self):
        if self.on_toggle:
            # Run in a separate thread to prevent blocking python keyboard hook pipeline
            threading.Thread(target=self.on_toggle, daemon=True).start()
