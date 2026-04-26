# Checklist bêta privée - Refait AC

Utiliser cette checklist avant de partager une build bêta à des testeurs privés.

## Machine propre

- [ ] Tester sur Windows 10.
- [ ] Tester sur Windows 11.
- [ ] Tester sur une machine avec WebView2 déjà installé.
- [ ] Tester ou documenter le comportement sur une machine sans WebView2.
- [ ] Vérifier le comportement de Windows SmartScreen.
- [ ] Confirmer que l'application démarre sans `npm`, sans Vite et sans le dossier du projet.

## Installation

- [ ] Télécharger l'installeur depuis GitHub Releases.
- [ ] Lancer `Refait AC_0.1.0_x64-setup.exe`.
- [ ] Vérifier que l'installation se termine sans erreur.
- [ ] Vérifier que l'application apparaît sous le nom `Refait AC`.
- [ ] Lancer l'application depuis le menu Démarrer.
- [ ] Vérifier que le dossier d'installation ne contient pas Python, PySide6, QtWebEngine, `node_modules`, Vite ou npm.

## Interface

- [ ] Vérifier la page Simple.
- [ ] Vérifier la page Avancé.
- [ ] Vérifier la page Système.
- [ ] Vérifier la page Infos.
- [ ] Vérifier que tous les contrôles sont atteignables en `580x480`.
- [ ] Vérifier que le scroll Avancé fonctionne.
- [ ] Vérifier que le scroll Système fonctionne si nécessaire.
- [ ] Vérifier que les états disabled restent lisibles.
- [ ] Vérifier que les états focus clavier sont visibles.
- [ ] Vérifier que le mode avancé actif est clair dans la page Simple.

## Paramètres et profils

- [ ] Modifier un réglage.
- [ ] Fermer puis relancer l'application.
- [ ] Vérifier que le réglage persiste.
- [ ] Sauvegarder `P1`.
- [ ] Sauvegarder un autre profil.
- [ ] Relancer l'application.
- [ ] Vérifier que chaque profil reste indépendant.

## Moteur autoclick

- [ ] Tester start/stop via le bouton UI avec `1` ou `2` CPS.
- [ ] Vérifier le délai de 700 ms au lancement depuis l'UI.
- [ ] Vérifier que le stop UI est immédiat.
- [ ] Tester start/stop avec `F6`.
- [ ] Vérifier que le lancement via `F6` démarre immédiatement ou presque.
- [ ] Tester la limite de clics.
- [ ] Tester clic gauche.
- [ ] Tester clic droit.
- [ ] Tester clic milieu si exposé dans l'UI.
- [ ] Tester le mode clavier si exposé dans l'UI avancée.
- [ ] Tester hold souris.
- [ ] Tester hold clavier si exposé dans l'UI avancée.

## Sécurité

- [ ] `Ctrl+Alt+F12` arrête toujours le moteur.
- [ ] `Ctrl+Alt+F12` fonctionne pendant un hold.
- [ ] Aucun clic ne continue après stop.
- [ ] Aucun bouton souris ou touche clavier ne reste maintenu après stop.
- [ ] Fermer l'application pendant que le moteur tourne arrête correctement le moteur.
- [ ] Relancer l'application ne double-enregistre pas les hotkeys.

## Liens et updates

- [ ] Les liens sociaux ouvrent le navigateur par défaut.
- [ ] La bannière update ne fait pas crash l'application.
- [ ] La bannière update affiche la dernière version GitHub si disponible.
- [ ] La bannière update n'installe rien automatiquement.

## Désinstallation et données utilisateur

- [ ] La désinstallation supprime le dossier d'installation.
- [ ] Le raccourci du menu Démarrer est supprimé.
- [ ] L'entrée de désinstallation Windows est supprimée.
- [ ] Vérifier si `%APPDATA%\com.refait.ac\` est conservé après désinstallation.
- [ ] Si nécessaire, supprimer manuellement `%APPDATA%\com.refait.ac\`.
- [ ] Relancer après suppression des données utilisateur et vérifier que l'application recrée des paramètres propres.

## Rapport de bug bêta

Demander aux testeurs de fournir :

- Version de Refait AC.
- Version Windows.
- Présence ou absence de WebView2.
- Étapes exactes pour reproduire.
- Résultat attendu.
- Résultat obtenu.
- Capture ou vidéo si utile.
- Indiquer si le panic stop `Ctrl+Alt+F12` a fonctionné.
