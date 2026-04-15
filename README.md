<div align="center">
  <img src="Refait.ico" width="100" />
  <h1>Refait AutoClicker</h1>
  <p><b>Le seul AutoClicker pensé pour YouTube, premium et minimaliste.</b></p>
</div>

<br/>

Refait AutoClicker est un logiciel open-source hybride Python/React conçu pour offrir une expérience esthétique inégalée (type macOS) couplée à un moteur de clic robuste et indétectable.

## ✨ Fonctionnalités Principales

- **Mode Classique & Avancé** : Basculez entre une fenêtre minimaliste volante ou un centre de contrôle complet.
- **Support Multi-Modes** :
  - `Spam` (Clics rapides constants, jusqu'à 100+ CPS)
  - `Hold` (Maintien de la touche enfoncée de façon prolongée)
  - `Keyboard` (Fonctionne à la fois sur la souris et sur le clavier !)
- **Profils Sauvegardés** : Sauvegardez jusqu'à 4 profils de jeu indépendants pour switcher en 1 clic.
- **Raccourcis Globaux** : Assignez la touche de votre choix (Ex: F6) pour piloter l'autoclicker en fond de tâche, même en jouant.
- **Auto-Updater** : Reste toujours à la page de la dernière version du dépôt.

## 🛠️ Stack Technique

- **Backend** : `Python 3.11` + `PySide6-WebEngine` (Google Chromium interne) pour une exécution garantie et ultra performante.
- **Frontend** : `React.js` + `Vite` + `TypeScript` + CSS Natif pour les animations de transitions.
- **Compilation** : `PyInstaller` (pour le binaire logiciel autonome) et `Inno Setup` (pour la conception de l'installeur).

## 🚀 Installation & Utilisation

### Pour les Utilisateurs (Téléchargement de l'app)
1. Rendez-vous dans l'onglet **[Releases](../../releases)** du répertoire GitHub.
2. Téléchargez l'exécutable `Install_RefaitAC_v1.0.exe`.
3. Lancez l'installation. L'application apparaîtra sur votre Bureau !

### Pour les Développeurs (Mode création)
Si vous souhaitez cloner et modifier le projet :

1. Installez `uv` et Node.js.
2. Clonez le dépôt :
```bash
git clone https://github.com/refait-fr/Refait-AC.git
cd Refait-AC
```
3. Compilez le frontend (React) :
```bash
cd frontend
npm install
npm run build
cd ..
```
4. Lancez le client Python :
```bash
uv run python -m refait_ac
```

## 🤝 Contribution & Réseaux
Développé au travers du projet YouTube de la chaîne Refait.
N'hésitez pas à interagir, ouvrir des issues, ou proposer des fonctionnalités via des Pull Requests !

- [🔗 Notre Chaîne YouTube](#)
- [💬 Serveur Discord](#)

---
<div align="center">
  <i>Conçu avec exigence.</i>
</div>
