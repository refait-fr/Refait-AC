# Changelog

## 0.1.0 bêta privée

Première bêta privée de Refait AC en Tauri.

### Ajouté

- Migration du shell Python/PySide6/QtWebEngine vers Tauri 2 + React + TypeScript + Rust.
- Moteur autoclick Rust.
- Start/stop depuis l'interface.
- Raccourci global `F6` pour start/stop.
- Panic stop `Ctrl+Alt+F12`.
- Délai de sécurité de 700 ms au lancement depuis l'interface.
- Persistance Rust pour les paramètres et profils.
- Profils persistants.
- Ouverture des liens dans le navigateur par défaut.
- Bannière update GitHub informative.
- Packaging Tauri NSIS.

### Taille

- Ancien installeur Python/PySide6 : environ `140 Mo`.
- Nouvel installeur Tauri : environ `2,67 Mo`.
- Ancienne application installée : environ `548 Mo`.
- Nouvelle application installée : environ `10,57 Mo`.

### Notes

- L'ancienne app Python reste dans le dépôt pour référence et rollback.
- Elle n'est pas incluse dans le build Tauri.
- Les modes clavier et hold clavier sont disponibles selon l'interface exposée dans la build testée.

### Limites connues

- Bêta privée non signée.
- Windows SmartScreen possible.
- Pas d'auto-update signé.
- WebView2 requis et non embarqué.
- Windows-first uniquement pour cette bêta.
- La bannière update informe seulement ; elle ne télécharge ni n'installe automatiquement.
