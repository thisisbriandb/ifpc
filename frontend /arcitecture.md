/app
 ├── layout.tsx        # Barre de navigation globale (Logo, Menu)
 ├── page.tsx          # Tableau de bord (Résumé des derniers lots)
 │
 ├── /pasteurization   # LE MODULE PASTO
 │    ├── page.tsx     # Interface principale (Upload + Résultats)
 │    ├── _components
 │    │    ├── FileUploader.tsx    # Zone de drag & drop CSV
 │    │    ├── TemperatureChart.tsx # Graphique (Recharts ou Tremor)
 │    │    └── ResultsCard.tsx     # Affiche "VP = 54 (Conforme)"
 │
 ├── /color-lab        # LE MODULE COULEUR
 │    ├── page.tsx     # Interface de formulation
 │    ├── /products    # Gestion des ingrédients
 │    ├── _components
 │    │    ├── ColorPreview.tsx    # Carré de couleur dynamique
 │    │    ├── IngredientSlider.tsx # Slider pour % de chaque jus
 │    │    └── LabInput.tsx        # Champs pour saisir L, a, b
 │
 └── /api              # (Optionnel si tout le calcul n'est pas en Python)