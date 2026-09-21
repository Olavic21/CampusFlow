# Inventaire lecture seule des assets branding avant generation
from pathlib import Path

root = Path(r"C:\Users\aimeo\CampusFlow")
downloads = root / "Downloads"
branding = root / "frontend" / "public" / "assets" / "branding"
icons = root / "frontend" / "public" / "assets" / "icons"
android = root / "frontend" / "android" / "app" / "src" / "main" / "res"

source = [
    downloads / "campusflow-logo-complet.png",
    downloads / "campusflow-icon-1024.png",
    downloads / "campusflow-icon.svg",
]

print("=== SOURCE ===")
for path in source:
    print(f"{path.name}: {'OK' if path.exists() else 'MISSING'} {path.stat().st_size if path.exists() else 0}")

print("\n=== branding (web public) ===")
for path in sorted(branding.glob("*")):
    print(f"{path.name}: {path.stat().st_size}")

print("\n=== icons (pwa) ===")
for path in sorted(icons.glob("*")):
    print(f"{path.name}: {path.stat().st_size}")

print("\n=== android bitmaps (ic_launcher/ic_launcher_foreground/ic_launcher_background/splash) ===")
for path in sorted(android.rglob("ic_launcher*.png")) + sorted(android.rglob("splash*.png")):
    print(f"{path.relative_to(root)}: {path.stat().st_size}")

print("\n=== android config files to patch ===")
for pat in [
    "mipmap-anydpi-v26/ic_launcher.xml",
    "mipmap-anydpi-v26/ic_launcher_round.xml",
    "values/strings.xml",
    "values/colors.xml",
    "values-v31/styles.xml",
    "drawable/splash.xml",
    "drawable-v21/splash.xml",
]:
    p = android / pat
    print(f"{pat}: {'OK' if p.exists() else 'MISSING'}")
