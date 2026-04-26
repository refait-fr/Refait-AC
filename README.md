# Refait AC

Refait AC est un autoclicker Windows léger, reconstruit en **Tauri 2 + React + TypeScript + Rust**.

Cette version est une **bêta privée**. Elle sert à valider le moteur Rust, les raccourcis globaux, la persistance des profils et le packaging léger avant une éventuelle release publique.

## Points forts

- Installeur Windows léger : environ `2,67 Mo`.
- Application installée : environ `10,57 Mo`.
- Moteur autoclick en Rust.
- Raccourci global start/stop : `F6`.
- Panic stop de sécurité : `Ctrl+Alt+F12`.
- Profils et paramètres persistants.
- Bannière de mise à jour basée sur GitHub Releases.
- Shell Tauri beaucoup plus léger que l'ancienne version PySide6/QtWebEngine.

## Installation bêta

1. Télécharger l'installeur depuis la page **GitHub Releases** du projet.
2. Lancer `Refait AC_0.1.0_x64-setup.exe`.
3. Ouvrir `Refait AC` depuis le menu Démarrer ou le dossier d'installation.

## Prérequis

- Windows 10 ou Windows 11.
- Microsoft Edge WebView2 Runtime.

Refait AC utilise WebView2 via Tauri. Le runtime WebView2 n'est pas embarqué afin de garder l'application légère. Sur Windows 10/11, il est généralement déjà installé. Si l'application ne s'ouvre pas, installer le **Microsoft Edge WebView2 Runtime** depuis le site officiel Microsoft.

## SmartScreen

La bêta n'est pas signée avec un certificat de code signing. Windows SmartScreen peut donc afficher un avertissement au premier lancement. C'est attendu pour une bêta privée non signée.

## Utilisation

1. Régler les CPS.
2. Choisir le bouton souris ou le mode souhaité.
3. Cliquer sur `DÉMARRER`.
4. Utiliser `F6` pour start/stop global.
5. Utiliser `Ctrl+Alt+F12` en panic stop si nécessaire.

Conseil de test : commencer avec `1` ou `2` CPS, puis augmenter progressivement. Tester le panic stop avant d'utiliser le mode hold.

La bannière update informe qu'une nouvelle version GitHub existe. Elle ne télécharge ni n'installe automatiquement une mise à jour.

## Données locales

Les paramètres et profils sont stockés ici :

```text
%APPDATA%\com.refait.ac\
```

Fichiers principaux :

- `settings.json`
- `profiles.json`

La désinstallation peut conserver ces données utilisateur. Pour repartir d'une configuration propre, fermer l'application puis supprimer manuellement ce dossier.

## Build depuis les sources

Depuis la racine du projet :

```powershell
npm install
npm install --prefix frontend
npm run build
npm run lint
npm exec tauri build
```

L'installeur généré se trouve ici :

```text
src-tauri/target/release/bundle/nsis/Refait AC_0.1.0_x64-setup.exe
```

Validation backend Tauri :

```powershell
npm run tauri:check
```

## Limites connues

- Bêta privée uniquement.
- Application non signée.
- SmartScreen possible.
- Pas d'auto-update signé.
- WebView2 requis et non embarqué.
- Windows-first pour cette bêta.
- macOS et Linux ne sont pas validés.

## QA bêta

Voir [BETA_TEST_CHECKLIST.md](BETA_TEST_CHECKLIST.md).

## Changelog

Voir [CHANGELOG.md](CHANGELOG.md).
