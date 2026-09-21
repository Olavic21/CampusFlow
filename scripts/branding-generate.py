# Generation des ressources visuelles CampusFlow officielles
# Source: assets officiels deja deploys dans frontend/public/assets/branding/
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


root = Path(r"C:\Users\aimeo\CampusFlow")
branding = root / "frontend" / "public" / "assets" / "branding"
android = root / "frontend" / "android" / "app" / "src" / "main" / "res"
pwa = root / "frontend" / "public" / "assets" / "icons"

LOGO_FULL = branding / "campusflow-logo.png"      # tout contexte large
ICON_SVG = branding / "campusflow-icon.svg"       # symbole officiel (vectoriel)
ICON_1024 = branding / "campusflow-icon-1024.png" # symbole officiel (bitmap master)

# Couleurs branding officielles
PRIMARY = (0x25, 0x63, 0xEB, 255)   # #2563EB


def load_master_icon():
    """Utilise le master officiel (PNG master officiel de preference)."""
    target = ICON_1024 if ICON_1024.exists() else None
    if target is None or not target.exists():
        fallback = branding / "campusflow-icon.png"
        target = fallback if fallback.exists() else None
    if target is None or not target.exists():
        fallback2 = branding / "campusflow-icon-1024.png"
        target = fallback2 if fallback2.exists() else None
    if target is None or not target.exists():
        raise SystemExit("Aucun master officiel trouve dans branding assets")
    return Image.open(target).convert("RGBA")


def resize_as_mask(img, size):
    img = img.copy()
    img.thumbnail(size, Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - img.width) // 2
    y = (size[1] - img.height) // 2
    out.paste(img, (x, y), img)
    return out


def make_launcher_foreground(size):
    """Official icon centered on transparent canvas for adaptive-foreground."""
    icon = load_master_icon()
    return resize_as_mask(icon, (size, size))


def make_launcher_background(size):
    """Solid primary background with subtle gradient + tiny inner frame."""
    w, h = size, size
    bg = Image.new("RGBA", (w, h), PRIMARY)
    overlay = Image.new("RGBA", (w, h), (255, 255, 255, 20))
    bg = Image.alpha_composite(bg, overlay)
    return bg.convert("RGB")


def make_splash_foreground(size):
    """Official icon centered for splash."""
    icon = load_master_icon()
    return resize_as_mask(icon, (size, size))


def compose_splash(foreground, background, size):
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.paste(background.convert("RGBA"), (0, 0), mask)
    out.alpha_composite(foreground.convert("RGBA"))
    return out


def save_png(path, img):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def save_webp(path, img, quality=90):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality)




print("=== Generating official launcher icons ===")
for density, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
                       ("xxhdpi", 144), ("xxxhdpi", 192)]:
    base = android / f"mipmap-{density}"
    fg = make_launcher_foreground(size)
    bg = make_launcher_background(size)
    save_png(base / "ic_launcher_foreground.png", fg)
    save_png(base / "ic_launcher_background.png", bg)
    # Round + square launcher icons built from foreground on primary bg
    round_base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0))
    round_base.paste(bg.convert("RGBA"), (0, 0), mask)
    round_base.alpha_composite(fg.convert("RGBA").filter(ImageFilter.GaussianBlur(0)))
    save_png(base / "ic_launcher.png", round_base.convert("RGB"))
    save_png(base / "ic_launcher_round.png", round_base.convert("RGB"))
    print(f"  {density}: {size}px")

def _make_splash(foreground, background, size):
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.paste(background.convert("RGBA"), (0, 0), mask)
    out.alpha_composite(foreground.convert("RGBA"))
    return out


print("\n=== Generating official splash icons (existing folders only) ===")
density_dp = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

for dir_name in [
    "drawable",
    "drawable-night",
    "drawable-land-mdpi",
    "drawable-land-hdpi",
    "drawable-land-xhdpi",
    "drawable-land-xxhdpi",
    "drawable-land-xxxhdpi",
    "drawable-port-mdpi",
    "drawable-port-hdpi",
    "drawable-port-xhdpi",
    "drawable-port-xxhdpi",
    "drawable-port-xxxhdpi",
    "drawable-land-night-mdpi",
    "drawable-land-night-hdpi",
    "drawable-land-night-xhdpi",
    "drawable-land-night-xxhdpi",
    "drawable-land-night-xxxhdpi",
    "drawable-port-night-mdpi",
    "drawable-port-night-hdpi",
    "drawable-port-night-xhdpi",
    "drawable-port-night-xxhdpi",
    "drawable-port-night-xxxhdpi",
]:
    dir_path = android / dir_name
    if not dir_path.exists():
        continue
    if "land" in dir_name and "night" not in dir_name:
        base = next((s for k, s in density_dp.items() if dir_name.endswith(k)), 48)
        size = max(24, round(base * 0.5))
        orientation = "landscape"
    elif "port" in dir_name and "night" not in dir_name:
        size = next((s for k, s in density_dp.items() if dir_name.endswith(k)), 48)
        orientation = "portrait"
    elif "night" in dir_name:
        if "land" in dir_name:
            base = next((s for k, s in density_dp.items() if dir_name.split("-")[-1] == k), 48)
            size = max(24, round(base * 0.5))
            orientation = "landscape-night"
        else:
            size = next((s for k, s in density_dp.items() if dir_name.split("-")[-1] == k), 48)
            orientation = "portrait-night"
    else:
        size = next((s for k, s in density_dp.items() if dir_name.endswith(k)), 48)
        orientation = "portrait"
    fg = make_splash_foreground(size)
    bg = make_launcher_background(size)
    save_png(dir_path / "splash.png", compose_splash(fg, bg, size))
    print(f"  {dir_name}/splash.png : {size}px ({orientation})")


print("\n=== Generating PWA icons (official master) ===")
master = load_master_icon()
for size in [48, 72, 96, 128, 192, 256, 512]:
    name = f"icon-{size}.webp"
    img = resize_as_mask(master, (size, size))
    save_webp(pwa / name, img)
    print(f"  {name}")

print("\n=== Updating strings.xml ===")
strings_file = android / "values" / "strings.xml"
current = strings_file.read_text(encoding="utf-8")
if "CampusFlow Lite" in current:
    updated = current.replace("CampusFlow Lite", "CampusFlow")
    strings_file.write_text(updated, encoding="utf-8")
    print("  strings.xml updated (CampusFlow Lite -> CampusFlow)")
else:
    print("  strings.xml already uses CampusFlow")

print("\n=== Generating apple-touch-icon (official master) ===")
apple_path = branding / "campusflow-icon-180.png"
apple = compose_splash(make_splash_foreground(180), make_launcher_background(180), 180)
save_png(apple_path, apple)
print(f"  campusflow-icon-180.png : {apple_path.stat().st_size} bytes")
