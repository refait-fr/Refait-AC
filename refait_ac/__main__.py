import sys
from pathlib import Path
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEngineScript
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QFile

from .core.engine import ClickEngine
from .core.input_manager import HotkeyManager
from .api import Api

def main():
    app = QApplication(sys.argv)
    
    engine = ClickEngine()
    input_manager = HotkeyManager()
    api = Api(engine, input_manager)
    
    window = QMainWindow()
    window.setWindowTitle("Refait AC")
    window.resize(550, 300)
    
    api.set_window(window)
    
    view = QWebEngineView()
    
    channel = QWebChannel()
    channel.registerObject("api", api)
    view.page().setWebChannel(channel)
    
    qwebchannel_js = QFile(":/qtwebchannel/qwebchannel.js")
    if qwebchannel_js.open(QFile.ReadOnly):
        source = bytes(qwebchannel_js.readAll()).decode('utf-8')
        script = QWebEngineScript()
        script.setSourceCode(source)
        script.setName("qwebchannel.js")
        script.setWorldId(QWebEngineScript.MainWorld)
        script.setInjectionPoint(QWebEngineScript.DocumentCreation)
        script.setRunsOnSubFrames(False)
        view.page().profile().scripts().insert(script)
        qwebchannel_js.close()
        
    bridge_script = QWebEngineScript()
    bridge_script.setSourceCode("""
        new QWebChannel(qt.webChannelTransport, function(channel) {
            window.backendApi = channel.objects.api;
            window.dispatchEvent(new CustomEvent('backendApiReady'));
        });
    """)
    bridge_script.setName("bridge.js")
    bridge_script.setWorldId(QWebEngineScript.MainWorld)
    bridge_script.setInjectionPoint(QWebEngineScript.DocumentReady)
    bridge_script.setRunsOnSubFrames(False)
    view.page().profile().scripts().insert(bridge_script)
    
    from PySide6.QtGui import QIcon

    api.engineStarted.connect(lambda: view.page().runJavaScript("if (window.onEngineStarted) window.onEngineStarted();"))
    api.engineStopped.connect(lambda: view.page().runJavaScript("if (window.onEngineStopped) window.onEngineStopped();"))
    api.updateAvailable.connect(lambda v, u: view.page().runJavaScript(f"if (window.onUpdateAvailable) window.onUpdateAvailable('{v}', '{u}');"))
    
    if getattr(sys, 'frozen', False):
        base_dir = Path(sys._MEIPASS)
    else:
        base_dir = Path(__file__).parent.parent
        
    frontend_dist = base_dir / "frontend" / "dist" / "index.html"
    icon_path = base_dir / "Refait.ico"
    
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))
    
    view.setUrl(f"file:///{frontend_dist.as_posix()}")
    
    window.setCentralWidget(view)
    window.show()
    
    app.aboutToQuit.connect(engine.stop_action)
    app.aboutToQuit.connect(input_manager.stop_listening)
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
