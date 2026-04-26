from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_TAG = "v0.1.0-beta"
DEFAULT_TITLE = "Refait AC 0.1.0 beta"
DEFAULT_ASSET = Path("src-tauri/target/release/bundle/nsis/Refait AC_0.1.0_x64-setup.exe")

DEFAULT_NOTES = """Beta privee de Refait AC.

- Migration vers Tauri 2 + React + TypeScript + Rust.
- Installeur ultra leger : environ 2,67 Mo.
- Application installee : environ 10,57 Mo.
- Moteur autoclick Rust.
- Hotkeys :
  - F6 start/stop
  - Ctrl+Alt+F12 panic stop
- Profils et settings persistants.
- WebView2 requis, non embarque.
- Application non signee : SmartScreen possible.
- Pas d'auto-update signe.

Merci aux testeurs de suivre BETA_TEST_CHECKLIST.md et de remonter les bugs avec les etapes de reproduction.
"""


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, check=check)


def read(command: list[str]) -> str:
    return run(command).stdout.strip()


def detect_repo() -> str:
    remote = read(["git", "remote", "get-url", "origin"])
    if remote.startswith("https://github.com/"):
        repo = remote.removeprefix("https://github.com/").removesuffix(".git")
        return repo
    if remote.startswith("git@github.com:"):
        repo = remote.removeprefix("git@github.com:").removesuffix(".git")
        return repo
    raise SystemExit(f"Remote GitHub non supporte : {remote}")


def current_branch() -> str:
    return read(["git", "branch", "--show-current"]) or "main"


def current_sha() -> str:
    return read(["git", "rev-parse", "HEAD"])


def asset_size_mb(asset: Path) -> float:
    return round(asset.stat().st_size / (1024 * 1024), 2)


def ensure_asset(asset: Path) -> None:
    if not asset.exists():
        raise SystemExit(f"Asset introuvable : {asset}")
    if not asset.is_file():
        raise SystemExit(f"Asset invalide : {asset}")


def ensure_no_existing_release_gh(repo: str, tag: str) -> None:
    result = run(["gh", "release", "view", tag, "--repo", repo], check=False)
    if result.returncode == 0:
        raise SystemExit(f"La release {tag} existe deja sur {repo}.")


def gh_is_authenticated() -> bool:
    if shutil.which("gh") is None:
        return False
    return run(["gh", "auth", "status"], check=False).returncode == 0


def publish_with_gh(repo: str, branch: str, tag: str, title: str, asset: Path, notes: str, dry_run: bool) -> str | None:
    command_preview = [
        "gh", "release", "create", tag, str(asset),
        "--repo", repo,
        "--target", branch,
        "--title", title,
        "--prerelease",
        "--notes-file", "<temp-release-notes>",
    ]

    if dry_run:
        print("Commande gh prevue :")
        print(" ".join(command_preview))
        return None

    if not gh_is_authenticated():
        raise SystemExit(
            "GitHub CLI n'est pas authentifie.\n"
            "Connecte-toi avec : gh auth login\n"
            "Scopes recommandes : repo"
        )

    ensure_no_existing_release_gh(repo, tag)

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=".md") as note_file:
        note_file.write(notes)
        notes_path = note_file.name

    try:
        command = command_preview.copy()
        command[-1] = notes_path
        run(command)
    finally:
        Path(notes_path).unlink(missing_ok=True)

    url = read(["gh", "release", "view", tag, "--repo", repo, "--json", "url", "--jq", ".url"])
    return url


def github_api(token: str, method: str, url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> dict:
    request_headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Refait-AC-release-script",
    }
    if headers:
        request_headers.update(headers)

    request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
            return json.loads(content.decode("utf-8")) if content else {}
    except urllib.error.HTTPError as error:
        if error.code == 404:
            raise FileNotFoundError(url) from error
        body = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Erreur GitHub API {error.code}: {body}") from error


def publish_with_api(repo: str, branch: str, tag: str, title: str, asset: Path, notes: str, dry_run: bool) -> str | None:
    api_base = f"https://api.github.com/repos/{repo}"
    upload_base = f"https://uploads.github.com/repos/{repo}"
    sha = current_sha()

    if dry_run:
        print("API GitHub prevue :")
        print(f"- create tag {tag} sur {sha} ({branch}) si absent")
        print(f"- create prerelease {title}")
        print(f"- upload asset {asset.name}")
        return None

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit(
            "Aucune authentification GitHub disponible.\n"
            "Option A : gh auth login\n"
            "Option B : definir GITHUB_TOKEN avec le scope repo"
        )

    try:
        github_api(token, "GET", f"{api_base}/releases/tags/{urllib.parse.quote(tag, safe='')}")
        raise SystemExit(f"La release {tag} existe deja sur {repo}.")
    except FileNotFoundError:
        pass

    try:
        github_api(token, "GET", f"{api_base}/git/ref/tags/{urllib.parse.quote(tag, safe='')}")
        tag_exists = True
    except FileNotFoundError:
        tag_exists = False

    if not tag_exists:
        payload = json.dumps({"ref": f"refs/tags/{tag}", "sha": sha}).encode("utf-8")
        github_api(token, "POST", f"{api_base}/git/refs", data=payload, headers={"Content-Type": "application/json"})

    release_payload = json.dumps({
        "tag_name": tag,
        "target_commitish": branch,
        "name": title,
        "body": notes,
        "draft": False,
        "prerelease": True,
    }).encode("utf-8")
    release = github_api(token, "POST", f"{api_base}/releases", data=release_payload, headers={"Content-Type": "application/json"})

    upload_url = f"{upload_base}/releases/{release['id']}/assets?name={urllib.parse.quote(asset.name)}"
    github_api(
        token,
        "POST",
        upload_url,
        data=asset.read_bytes(),
        headers={"Content-Type": "application/octet-stream"},
    )
    return release["html_url"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Publie une beta GitHub prerelease de Refait AC.")
    parser.add_argument("--tag", default=DEFAULT_TAG)
    parser.add_argument("--title", default=DEFAULT_TITLE)
    parser.add_argument("--asset", type=Path, default=DEFAULT_ASSET)
    parser.add_argument("--repo", default=None)
    parser.add_argument("--method", choices=["auto", "gh", "api"], default="auto")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repo = args.repo or detect_repo()
    branch = current_branch()
    asset = args.asset
    ensure_asset(asset)

    print("Plan de publication")
    print(f"- repo      : {repo}")
    print(f"- branche   : {branch}")
    print(f"- tag       : {args.tag}")
    print(f"- release   : {args.title}")
    print(f"- prerelease: oui")
    print(f"- asset     : {asset} ({asset_size_mb(asset)} Mo)")

    if args.method == "gh" or (args.method == "auto" and gh_is_authenticated()):
        url = publish_with_gh(repo, branch, args.tag, args.title, asset, DEFAULT_NOTES, args.dry_run)
    else:
        url = publish_with_api(repo, branch, args.tag, args.title, asset, DEFAULT_NOTES, args.dry_run)

    if url:
        print(f"Release publiee : {url}")


if __name__ == "__main__":
    main()
