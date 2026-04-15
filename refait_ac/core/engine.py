import time
import threading
from pynput.mouse import Controller as MouseController, Button as MouseButton
from pynput.keyboard import Controller as KeyboardController

class ActionMode:
    CLICK = "click"
    KEYBOARD = "keyboard"
    HOLD = "hold"

class ClickEngine:
    def __init__(self):
        self.mouse = MouseController()
        self.keyboard = KeyboardController()
        
        self.is_running = False
        self._thread = None
        
        # Options
        self.mode = ActionMode.CLICK
        self.target_cps = 100.0
        self.mouse_button = MouseButton.left
        self.keyboard_key = 'e'
        self.hold_type = "mouse"
        self.limit = 0
        
        self.on_started = None
        self.on_stopped = None

    def start_action(self):
        if not self.is_running:
            self.is_running = True
            self._thread = threading.Thread(target=self.run, daemon=True)
            self._thread.start()
            if self.on_started:
                self.on_started()
            
    def stop_action(self):
        if self.is_running:
            self.is_running = False
            if self._thread:
                self._thread.join(timeout=1.0)
            
            # Cleanup for HOLD mode
            if self.mode == ActionMode.HOLD:
                if self.hold_type == "mouse":
                    self.mouse.release(self.mouse_button)
                else:
                    try:
                        self.keyboard.release(self.keyboard_key)
                    except ValueError:
                        pass
                        
            if self.on_stopped:
                self.on_stopped()

    def run(self):
        clicks_done = 0

        if self.mode == ActionMode.HOLD:
            if self.hold_type == "mouse":
                self.mouse.press(self.mouse_button)
            else:
                try:
                    self.keyboard.press(self.keyboard_key)
                except ValueError:
                    pass
            
            while self.is_running:
                time.sleep(0.01)
            return

        interval = 1.0 / max(0.1, self.target_cps)
        next_time = time.perf_counter() + interval

        while self.is_running:
            # Execute one action
            if self.mode == ActionMode.CLICK:
                self.mouse.click(self.mouse_button, 1)
            elif self.mode == ActionMode.KEYBOARD:
                try:
                    self.keyboard.tap(self.keyboard_key)
                except ValueError:
                    pass

            clicks_done += 1

            if self.limit > 0 and clicks_done >= self.limit:
                self.is_running = False
                break

            # High precision sleep/busy wait loop
            while time.perf_counter() < next_time:
                rem = next_time - time.perf_counter()
                if rem > 0.002: # 2ms
                    time.sleep(0.001)
                else:
                    pass # Busy wait
                    
            next_time += interval
            
        self.is_running = False
        if self.on_stopped:
            self.on_stopped()
