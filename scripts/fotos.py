# Fotos de Casa Freixe → img/fotos/<nombre>-<ancho>.{webp,jpg} + img/fotos/fotos.json. NUNCA se amplía.
#   python -I -X utf8 scripts/fotos.py
# Origen: las de su web (ref/origen/web/, 800 px como mucho, 2014) y la de su ficha de Turismo Asturias (708 px).
# Están muy saturadas (paredes naranjas, viñeteado de la cámara). Tratamiento, EL MISMO para todas y suave, sin inventar:
#   1. quitar parte del viñeteado: ganancia radial que sube como mucho un 9 % en las esquinas;
#   2. balance algo más frío: rojo ×0,965, azul ×1,03;
#   3. saturación ×0,86 (bajan los naranjas sin volverlos grises).
# Las que llegaron cortadas (descarga a medias) se recortan por la banda gris de abajo, sin rellenar nada.
# Los banners *.png de 1000×446 llevan su logo impreso: no se usan. entorno__222.jpg está vacío.
# Se sirven a 400 y a su tamaño real (≤ 800).
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFile, ImageEnhance

ImageFile.LOAD_TRUNCATED_IMAGES = True
RAIZ = Path(__file__).resolve().parent.parent
ORI = RAIZ / 'ref/origen'
SAL = RAIZ / 'img/fotos'
SAL.mkdir(parents=True, exist_ok=True)

# nombre en la web → (fichero de origen, apartamento o grupo, recorte de abajo en px por descarga cortada)
I = 'web/alquiler-apartamento-oscos__'
II = 'web/apartamento-rural-oscos__'
FOTOS = {
    # Apartamento I (por la ruta de su web: confirmar)
    'i-cocina-chimenea': (I + 'DSC_0313.jpg', 'I', 0),
    'i-escalera': (I + 'DSC_0336.jpg', 'I', 0),
    'i-escalera-piedra': (I + 'DSC_0339.jpg', 'I', 0),
    'i-dormitorio-buhardilla': (I + 'DSC_0340.jpg', 'I', 0),
    'i-dormitorio-naranja': (I + 'DSC_0350.jpg', 'I', 0),
    'i-dormitorio-puerta-bano': (I + 'DSC_0358.jpg', 'I', 0),
    'i-bano': (I + 'DSC_0361.jpg', 'I', 0),
    'i-cantaros': (I + 'DSC_0362.jpg', 'I', 0),
    'i-dormitorio-armario': (I + 'la_foto_(1).jpg', 'I', 0),
    # Apartamento II
    'ii-entrada': (II + 'DSC_0199.jpg', 'II', 0),
    'ii-cocina-sofa': (II + 'DSC_0201.jpg', 'II', 0),
    'ii-cocina-chimenea': (II + 'DSC_0207.jpg', 'II', 0),
    'ii-cocina-mesa': (II + 'DSC_0212.jpg', 'II', 0),
    'ii-chimenea-puerta': (II + 'DSC_0224.jpg', 'II', 0),
    'ii-chimenea-fuego': (II + 'DSC_0246.jpg', 'II', 0),
    'ii-dormitorio-piedra': (II + 'DSC_0251.jpg', 'II', 0),
    'ii-dormitorio-ventana': (II + 'DSC_0253.jpg', 'II', 0),
    'ii-bano': (II + 'DSC_0283.jpg', 'II', 0),
    'ii-dormitorio-maleta': (II + 'DSC_0399.jpg', 'II', 0),
    'ii-dormitorio-libro': (II + 'DSC_0406.jpg', 'II', 0),
    'ii-salon': (II + 'la_foto_(2).jpg', 'II', 0),
    'ii-dormitorio-amarillo': (II + 'la_foto_(3).jpg', 'II', 0),
    # fuera
    'casa-fachada': ('turismoasturias-AR0311_FreixeI1.jpg', 'fuera', 0),
    'casa-porche': ('web/turismo-rural-oscos__DSC_0387.jpg', 'fuera', 0),
    'casa-camino': ('web/turismo-rural-oscos__DSC_0421.jpg', 'fuera', 0),
    'aldea-entre-hojas': ('web/turismo-rural-oscos__DSC_0443.jpg', 'fuera', 16),
    # entorno
    'valle-otono': ('web/entorno__02365.jpg', 'entorno', 0),
    'ventana-pizarra': ('web/entorno__DSC_0196.jpg', 'entorno', 0),
    'horreo': ('web/entorno__DSC_0303.jpg', 'entorno', 0),
    'cascada-otono': ('web/entorno__111.jpg', 'entorno', 0),
}


def banda_gris(a):
    """Filas de abajo que son la banda gris uniforme de una descarga cortada."""
    h = a.shape[0]
    n = 0
    for y in range(h - 1, h // 2, -1):
        fila = a[y].astype(int)
        if fila.std() < 3 and abs(fila.mean() - 128) < 12:
            n += 1
        else:
            break
    return n


def tratar(im):
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)) / np.sqrt(2)
    gan = 1 + 0.09 * np.clip((r - 0.45) / 0.55, 0, 1) ** 2
    a = a * gan[..., None]
    a[..., 0] *= 0.965
    a[..., 2] *= 1.03
    out = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    return ImageEnhance.Color(out).enhance(0.86)


lista = []
for nombre, (fuente, grupo, corte) in FOTOS.items():
    im = Image.open(ORI / fuente).convert('RGB')
    a = np.asarray(im)
    if corte == 'auto':
        corte = banda_gris(a)
    if corte:
        im = im.crop((0, 0, im.width, im.height - corte - 2))
    im = tratar(im)
    W = im.width
    anchos = sorted({min(400, W), W})
    for w in anchos:
        x = im if w == W else im.resize((w, round(im.height * w / W)), Image.LANCZOS)
        x.save(SAL / f'{nombre}-{w}.webp', 'WEBP', quality=82, method=6)
        x.save(SAL / f'{nombre}-{w}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)
    origen = 'Turismo Asturias (ficha oficial de Freixe I)' if 'turismoasturias' in fuente else 'casafreixe.com (su web, 2014)'
    lista.append({'nombre': nombre, 'grupo': grupo, 'ancho': W, 'alto': im.height, 'anchos': anchos,
                  'fuente': fuente, 'origen': origen, 'recorte': int(corte or 0)})
    print(f'{nombre:28} {W}×{im.height} {anchos}{"  recortada " + str(corte) + " px" if corte else ""}')

(SAL / 'fotos.json').write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(lista), 'fotos')
