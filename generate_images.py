#!/usr/bin/env python3
"""
Génère les visuels du site de démonstration.
Certaines images sont volontairement produites en haute résolution
et non recadrées à l'usage (anti-pattern pédagogique étudié plus tard
par les apprenants en écoconception).
"""
from PIL import Image, ImageDraw, ImageFont
import os, random

OUT = "/home/claude/servicepublic/img"
os.makedirs(OUT, exist_ok=True)

def font(size, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def grad_bg(w, h, c1, c2, vertical=True):
    img = Image.new("RGB", (w, h), c1)
    draw = ImageDraw.Draw(img)
    for i in range(h if vertical else w):
        t = i/(h if vertical else w)
        r = int(c1[0]+(c2[0]-c1[0])*t)
        g = int(c1[1]+(c2[1]-c1[1])*t)
        b = int(c1[2]+(c2[2]-c1[2])*t)
        if vertical:
            draw.line([(0,i),(w,i)], fill=(r,g,b))
        else:
            draw.line([(i,0),(i,h)], fill=(r,g,b))
    return img

BLEU_FONCE = (0,0,91)
BLEU_CLAIR = (106,106,244)
ROUGE = (225,0,15)
GRIS = (230,230,230)
GRIS_FONCE = (90,90,90)

# ---------------------------------------------------------------
# 1) Image hero — illustration "démarches en ligne" (HD, non compressée)
# ---------------------------------------------------------------
def hero_illustration():
    w,h = 1600, 1200  # volontairement grand pour un encart qui ne fera que 600px de large à l'écran
    img = grad_bg(w,h,(20,20,120),(70,70,210))
    d = ImageDraw.Draw(img)
    # silhouette d'écran / formulaire stylisé
    d.rounded_rectangle([260,180,1340,1020], radius=40, fill=(255,255,255))
    d.rectangle([260,180,1340,300], fill=(0,0,91))
    d.rounded_rectangle([260,180,1340,300], radius=40, fill=(0,0,91))
    d.rectangle([260,240,1340,300], fill=(0,0,91))
    f_big = font(54, bold=True)
    d.text((310,210), "Mon espace démarches", font=f_big, fill=(255,255,255))
    # lignes de formulaire
    y = 360
    for i in range(5):
        d.rounded_rectangle([320,y,1280,y+70], radius=10, fill=(240,240,250))
        d.rounded_rectangle([320,y,560,y+70], radius=10, fill=(106,106,244))
        y += 110
    d.rounded_rectangle([320,920,620,1000], radius=10, fill=(225,0,15))
    f_btn = font(34, bold=True)
    d.text((370,945), "Valider", font=f_btn, fill=(255,255,255))
    # quelques cercles décoratifs
    for cx,cy,r,col in [(150,150,90,(255,255,255)), (1480,1080,130,(255,255,255)), (1500,150,60,(225,0,15))]:
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=col)
    img.save(f"{OUT}/hero-illustration.jpg", quality=95)  # qualité volontairement haute -> fichier lourd

# ---------------------------------------------------------------
# 2) Images d'actualité (3 cartes, HD non recadrées au format d'affichage)
# ---------------------------------------------------------------
def actu_images():
    themes = [
        ("actu-1.jpg", (0,70,140), (70,160,230), "Élections 2026"),
        ("actu-2.jpg", (140,40,10), (230,120,60), "Nouveaux horaires"),
        ("actu-3.jpg", (10,90,40), (90,200,120), "Simplification"),
    ]
    for fname, c1, c2, label in themes:
        w,h = 1920, 1280  # full HD+, affiché ensuite en 360x220 dans les cartes
        img = grad_bg(w,h,c1,c2)
        d = ImageDraw.Draw(img)
        for _ in range(40):
            x,y = random.randint(0,w), random.randint(0,h)
            r = random.randint(10,90)
            d.ellipse([x-r,y-r,x+r,y+r], fill=tuple(min(255,c+30) for c in c2), outline=None)
        f = font(64, bold=True)
        d.rectangle([0,h-160,w,h], fill=(0,0,0))
        d.text((60,h-130), label, font=f, fill=(255,255,255))
        img.save(f"{OUT}/{fname}", quality=92)

# ---------------------------------------------------------------
# 3) Logos partenaires (carrousel défilant)
# ---------------------------------------------------------------
def logos_partenaires():
    noms = ["Ministère X","Région Y","Caisse Z","Agence A","Office B","Préfecture C"]
    for i, nom in enumerate(noms):
        w,h = 400,160
        img = Image.new("RGBA",(w,h),(255,255,255,0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0,0,w-1,h-1], radius=14, outline=(120,120,120), width=3)
        f = font(30, bold=True)
        bbox = d.textbbox((0,0), nom, font=f)
        tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
        d.text(((w-tw)/2,(h-th)/2-8), nom, font=f, fill=(60,60,60))
        img.save(f"{OUT}/logo-{i+1}.png")

# ---------------------------------------------------------------
# 4) Exemples de pièces justificatives (service inscription électorale)
#    -> volontairement en haute résolution (anti-pattern étudié)
# ---------------------------------------------------------------
def piece_identite(filename, valide=True, probleme=""):
    w,h = 1400, 900
    img = Image.new("RGB",(w,h), (245,245,248))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40,40,w-40,h-40], radius=24, outline=(0,0,91), width=6, fill=(255,255,255))
    f_title = font(40, bold=True)
    f_text = font(26)
    f_small = font(20)
    d.text((90,80), "RÉPUBLIQUE FRANÇAISE", font=f_title, fill=(0,0,91))
    d.text((90,140), "CARTE NATIONALE D'IDENTITÉ", font=font(30,bold=True), fill=(30,30,30))
    d.line([90,190,w-90,190], fill=(200,200,200), width=2)

    # photo placeholder
    photo_box = [90,230,390,650]
    photo_color = (210,215,225) if valide else (60,60,60)
    d.rectangle(photo_box, fill=photo_color, outline=(150,150,150), width=2)
    d.text((150,420), "PHOTO", font=f_text, fill=(255,255,255) if not valide else (120,120,130))

    champs = [
        ("Nom", "MARTIN" if valide else "MARTIN (flou)"),
        ("Prénom", "Claire"),
        ("Né(e) le", "14/03/1990"),
        ("Sexe", "F"),
        ("Taille", "1,68 m"),
    ]
    y = 240
    for label, val in champs:
        d.text((430,y), label.upper(), font=f_small, fill=(120,120,120))
        d.text((430,y+26), val, font=f_text, fill=(20,20,20))
        y += 80

    if not valide:
        # filigrane / problème
        overlay = Image.new("RGBA",(w,h),(0,0,0,0))
        od = ImageDraw.Draw(overlay)
        if probleme == "flou":
            img = img.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(6))
            d = ImageDraw.Draw(img)
        elif probleme == "coupe":
            d.rectangle([0,0,w,150], fill=(245,245,248))
        elif probleme == "reflet":
            od.polygon([(0,0),(w,0),(w*0.3,h),(0,h)], fill=(255,255,255,90))
            img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
            d = ImageDraw.Draw(img)
        bandeau = "DOCUMENT NON CONFORME" 
        d.rectangle([0,h-70,w,h-40], fill=(225,0,15))
        d.text((60,h-66), bandeau, font=font(24,bold=True), fill=(255,255,255))
    else:
        d.rectangle([0,h-70,w,h-40], fill=(20,140,60))
        d.text((60,h-66), "EXEMPLE CONFORME", font=font(24,bold=True), fill=(255,255,255))

    img.save(f"{OUT}/{filename}", quality=95)

def generer_exemples_pieces():
    piece_identite("exemple-cni-conforme.jpg", valide=True)
    piece_identite("exemple-cni-floue.jpg", valide=False, probleme="flou")
    piece_identite("exemple-cni-coupee.jpg", valide=False, probleme="coupe")
    piece_identite("exemple-cni-reflet.jpg", valide=False, probleme="reflet")

# ---------------------------------------------------------------
# 5) Mascotte flottante décorative (PNG transparent, animée en CSS)
# ---------------------------------------------------------------
def mascotte():
    w,h = 600,600
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    d.ellipse([100,100,500,500], fill=(0,0,145,255))
    d.ellipse([180,220,280,320], fill=(255,255,255,255))
    d.ellipse([320,220,420,320], fill=(255,255,255,255))
    d.ellipse([205,245,255,295], fill=(20,20,20,255))
    d.ellipse([345,245,395,295], fill=(20,20,20,255))
    d.arc([220,330,380,430], start=200, end=340, fill=(255,255,255,255), width=12)
    img.save(f"{OUT}/mascotte.png")

# ---------------------------------------------------------------
# 6) Pictos services (simples SVG en data — non, on fait des PNG légers)
# ---------------------------------------------------------------
def picto_simple(filename, emoji_like_shape, color):
    w,h = 120,120
    img = Image.new("RGBA",(w,h),(0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0,0,w,h], radius=24, fill=color)
    d.ellipse([30,25,90,85], outline=(255,255,255), width=6)
    img.save(f"{OUT}/{filename}")

if __name__ == "__main__":
    hero_illustration()
    actu_images()
    logos_partenaires()
    generer_exemples_pieces()
    mascotte()
    print("OK — images générées dans", OUT)
    for f in sorted(os.listdir(OUT)):
        size_ko = os.path.getsize(os.path.join(OUT,f))/1024
        print(f"  {f}: {size_ko:.0f} Ko")
