# Génère/recherche le branding officiel autour du build web
$root = "C:\Users\aimeo\CampusFlow\frontend"
$branding = "$root\public\assets\branding"
$public = "$root\public"
$dist = "$root\dist"
$py = "C:\Users\aimeo\CampusFlow\.venv\Scripts\python.exe"

Write-Host "=== Supprimer ancien logo.svg si présent ==="
$old = "$public\logo.svg"
if (Test-Path $old) {
    Remove-Item $old -Force
    Write-Host "supprimé : $old"
}

Write-Host "=== Générer apple-touch-icon-180.png ==="
& $py -c @"
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(r'C:\Users\aimeo\CampusFlow')
branding = root / 'frontend' / 'public' / 'assets' / 'branding'
android = root / 'frontend' / 'android' / 'app' / 'src' / 'main' / 'res'
PRIMARY = (0x25,0x63,0xEB,255)
ICON_1024 = branding / 'campusflow-icon-1024.png'

def load_master_icon():
    target = ICON_1024 if ICON_1024.exists() else None
    if target is None or not target.exists():
        raise SystemExit('Aucun master officiel trouve')
    return Image.open(target).convert('RGBA')

def resize_as_mask(img, size):
    img = img.copy()
    img.thumbnail(size, Image.LANCZOS)
    out = Image.new('RGBA', size, (0,0,0,0))
    x = (size[0]-img.width)//2
    y = (size[1]-img.height)//2
    out.paste(img,(x,y),img)
    return out

def make_splash_foreground(size):
    return resize_as_mask(load_master_icon(),(size,size))

def make_launcher_background(size):
    bg = Image.new('RGBA',(size,size),PRIMARY)
    overlay = Image.new('RGBA',(size,size),(255,255,255,20))
    bg = Image.alpha_composite(bg,overlay)
    return bg.convert('RGB')

def compose_splash(fg,bg,size):
    out = Image.new('RGBA',(size,size),(0,0,0,0))
    mask = Image.new('L',(size,size),0)
    ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255)
    out.paste(bg.convert('RGBA'),(0,0),mask)
    out.alpha_composite(fg.convert('RGBA'))
    return out

def save_png(path,img):
    path.parent.mkdir(parents=True,exist_ok=True)
    img.save(path,'PNG')

apple = compose_splash(make_splash_foreground(180), make_launcher_background(180), 180)
save_png(branding/'campusflow-icon-180.png', apple.convert('RGB'))
print('apple-touch-icon generated')
"@

Write-Host "=== apple-touch-icon créé ==="
Get-Item "$branding\campusflow-icon-180.png" -ErrorAction SilentlyContinue | Select-Object Name,Length

Write-Host "=== index.html refs ==="
Select-String -Path "$root\index.html" -Pattern 'logo|assets/branding|campusflow-icon|manifest|theme-color|description' -SimpleMatch -ErrorAction SilentlyContinue | Select-Object LineNumber,Line

Write-Host "=== build web ==="
Set-Location $root
$npm = "$root\node_modules\.bin\npm-cli.js"
if (-not (Test-Path $npm)) {
    $npm = "npm"
}
& $npm run build
