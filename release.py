import sys
import re
import subprocess
from pathlib import Path
import shutil

def update_version_in_file(filepath: Path, search_pattern: str, replacement: str):
    if not filepath.exists():
        print(f"Erreur : Le fichier {filepath} est introuvable.")
        sys.exit(1)
        
    content = filepath.read_text(encoding='utf-8')
    new_content = re.sub(search_pattern, replacement, content, flags=re.MULTILINE)
    
    if new_content == content:
        print(f"Attention : Aucune modification apportée à {filepath.name}. Motif non repéré.")
    else:
        filepath.write_text(new_content, encoding='utf-8')
        print(f"✅ Version mise à jour dans {filepath.name}")

def main():
    print('=====================================')
    print('🚀 REFAIT AUTOCLICKER - RELEASE MANAGER')
    print('=====================================\n')

    # 1. Demander la version
    version = input("Entrez la nouvelle version à publier (ex: v1.0.1) : ").strip()
    if not version.startswith('v'):
        print("Erreur : La version doit commencer par un 'v' (ex: v1.1.0).")
        sys.exit(1)
        
    ver_clean = version[1:] # retire le 'v' pour les systèmes ne le voulant pas
    
    print(f"\n🚀 Lancement du déploiement continu pour la version {version}...")

    # 2. Mettre à jour api.py
    api_path = Path("refait_ac/api.py")
    update_version_in_file(
        api_path,
        r'CURRENT_VERSION\s*=\s*".*"',
        f'CURRENT_VERSION = "{version}"'
    )
    
    # 3. Mettre à jour Inno Setup script
    iss_path = Path("install_script.iss")
    update_version_in_file(
        iss_path,
        r'^AppVersion=.*$',
        f'AppVersion={ver_clean}'
    )
    update_version_in_file(
        iss_path,
        r'^OutputBaseFilename=.*$',
        f'OutputBaseFilename=Install_RefaitAC_{version}'
    )

    # 4. Lancer le build complet (React + Pyinstaller + Inno Setup)
    print("\n🔨 Lancement de build.bat (Frontend + Pyinstaller + ISS)...")
    process = subprocess.run(["build.bat"], shell=True)
    if process.returncode != 0:
        print("❌ Erreur pendant la compilation locale. Arrêt.")
        sys.exit(1)

    # Vérification fichier Installeur final
    installer_path = Path(f"Installer/Install_RefaitAC_{version}.exe")
    if not installer_path.exists():
        print(f"❌ L'installeur ({installer_path}) n'a pas été généré ! As-tu bien installé Inno Setup sous 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe' ?")
        sys.exit(1)
        
    # 5. Commit et Push Git
    print("\n📦 Commit Git et envoi vers GitHub...")
    subprocess.run(["git", "add", "."], shell=True, check=True)
    subprocess.run(["git", "commit", "-m", f"chore: Release {version}"], shell=True, check=True)
    subprocess.run(["git", "push"], shell=True, check=True)

    # 6. Upload GitHub Release
    print("\n🌐 Création de la Release GitHub...")
    print("Vérification de GitHub CLI (gh)...")
    if shutil.which("gh") is None:
        print("⚠️ GitHub CLI (gh) n'est pas détecté sur cet ordinateur.")
        print("Télécharge-le sur https://cli.github.com/ pour automatiser l'upload de la Release.")
        print(f"En attendant, tu peux aller l'uploader manuellement depuis la page GitHub en utilisant le fichier : {installer_path}")
        sys.exit(0)
        
    print(f"Upload de {installer_path}...")
    release_cmd = [
        "gh", "release", "create", version, str(installer_path),
        "-t", f"Refait AutoClicker {version}",
        "-n", f"Nouvelle version officielle: {version}\n\nTéléchargez l'installeur ci-dessous pour profiter de la mise à jour !"
    ]
    
    upload_process = subprocess.run(release_cmd, shell=True)
    if upload_process.returncode == 0:
        print(f"\n🎉 SUCCÈS ! La version {version} est en ligne sur ton GitHub !")
    else:
        print("\n❌ Erreur pendant la création de la Release via 'gh'.")
        print("Assure-toi d'être connecté via 'gh auth login'.")

if __name__ == "__main__":
    main()
