"""
Prépare l'image photoréaliste de la cuve pour le composant frontend :
1. Supprime le fond blanc avec rembg
2. Rend la zone cylindrique du corps semi-transparente (~20% opacity) pour l'effet verre
3. Exporte en PNG transparent
"""

import numpy as np
from PIL import Image, ImageFilter
from rembg import remove
from pathlib import Path

INPUT = Path("/home/briand/ifpc/frontend/public/assets/cuve.png")
OUTPUT = Path("/home/briand/ifpc/frontend/public/assets/cuve-overlay.png")


def main():
    print("1. Chargement de l'image...")
    img = Image.open(INPUT).convert("RGBA")
    w, h = img.size
    print(f"   Dimensions: {w}x{h}")

    print("2. Suppression du fond avec rembg...")
    img_no_bg = remove(img)

    print("3. Détection de la zone cylindrique (corps de la cuve)...")
    # On analyse l'image pour trouver les limites du corps cylindrique
    # La cuve est centrée horizontalement. On identifie la zone corps :
    # - Haut du corps : juste sous le dôme (~28% de la hauteur)
    # - Bas du corps : juste au-dessus des pieds (~78% de la hauteur)
    # - Gauche/droite : les bords du cylindre

    arr = np.array(img_no_bg)
    alpha = arr[:, :, 3]

    # Trouver les limites horizontales du tank (colonnes non-transparentes)
    col_mask = alpha.max(axis=0) > 50
    cols = np.where(col_mask)[0]
    left_col, right_col = cols[0], cols[-1]
    tank_width = right_col - left_col
    center_x = (left_col + right_col) // 2

    # Trouver les limites verticales
    row_mask = alpha.max(axis=1) > 50
    rows = np.where(row_mask)[0]
    top_row, bottom_row = rows[0], rows[-1]
    tank_height = bottom_row - top_row

    print(f"   Tank bounds: x=[{left_col}, {right_col}], y=[{top_row}, {bottom_row}]")
    print(f"   Tank size: {tank_width}x{tank_height}")

    # Zone cylindrique du corps (proportions estimées de l'image)
    # Le dôme va de top à environ top + 30% de tank_height
    # Les pieds commencent à environ top + 80% de tank_height
    body_top = int(top_row + tank_height * 0.28)
    body_bottom = int(top_row + tank_height * 0.78)

    # Largeur du cylindre : légèrement inset par rapport au tank total
    body_left = int(left_col + tank_width * 0.12)
    body_right = int(right_col - tank_width * 0.12)

    print(f"   Body zone: x=[{body_left}, {body_right}], y=[{body_top}, {body_bottom}]")

    print("4. Suppression du texte CUVE-12 (zone label)...")
    body_h = body_bottom - body_top
    body_w = body_right - body_left

    # Remove the "CUVE-12" label text area only (make it match surrounding metal)
    label_top = int(body_top + body_h * 0.10)
    label_bottom = int(body_top + body_h * 0.35)
    label_left = int(center_x - body_w * 0.30)
    label_right = int(center_x + body_w * 0.28)
    print(f"   Label zone: x=[{label_left}, {label_right}], y=[{label_top}, {label_bottom}]")

    # Fill label area with average surrounding metal color (instead of transparent)
    # Sample the metal color from just above the label
    sample_y = max(0, label_top - 5)
    sample_colors = []
    for x in range(label_left, label_right):
        if arr[sample_y, x, 3] > 100:
            sample_colors.append(arr[sample_y, x, :3])
    if sample_colors:
        avg_color = np.mean(sample_colors, axis=0).astype(np.uint8)
        print(f"   Avg metal color: RGB({avg_color[0]}, {avg_color[1]}, {avg_color[2]})")
        for y in range(label_top, label_bottom):
            for x in range(label_left, label_right):
                if arr[y, x, 3] > 50:
                    # Blend towards average metal color to erase the text
                    arr[y, x, 0] = avg_color[0]
                    arr[y, x, 1] = avg_color[1]
                    arr[y, x, 2] = avg_color[2]

    # Body stays FULLY OPAQUE — mix-blend-mode: multiply handles the liquid illusion

    print("5. Crop serré autour de la cuve (format portrait)...")
    result = Image.fromarray(arr)

    # Crop to tight bounding box of visible pixels (the tank only)
    # Re-read alpha from processed array
    final_alpha = arr[:, :, 3]
    col_visible = final_alpha.max(axis=0) > 10
    row_visible = final_alpha.max(axis=1) > 10
    visible_cols = np.where(col_visible)[0]
    visible_rows = np.where(row_visible)[0]

    if len(visible_cols) > 0 and len(visible_rows) > 0:
        crop_left = max(0, visible_cols[0] - 20)
        crop_right = min(w, visible_cols[-1] + 20)
        crop_top = max(0, visible_rows[0] - 10)
        crop_bottom = min(h, visible_rows[-1] + 10)
        result = result.crop((crop_left, crop_top, crop_right, crop_bottom))
        print(f"   Cropped: {result.size[0]}x{result.size[1]}")

    # Resize pour le web (max 500px de haut pour performance)
    cw, ch = result.size
    max_h = 500
    if ch > max_h:
        ratio = max_h / ch
        new_w = int(cw * ratio)
        result = result.resize((new_w, max_h), Image.LANCZOS)
        print(f"   Redimensionné à {new_w}x{max_h}")

    result.save(OUTPUT, "PNG", optimize=True)
    print(f"   ✅ Sauvegardé: {OUTPUT}")
    print(f"   Dimensions finales: {result.size[0]}x{result.size[1]}")
    print(f"   Taille fichier: {OUTPUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
