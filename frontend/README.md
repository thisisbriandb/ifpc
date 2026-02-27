# IFPC Frontend

Application Next.js pour l'évaluation de la pasteurisation avec les couleurs de marque IFPC.

## Couleurs de marque

```css
--brand-primary:   #84A44A  /* Vert principal */
--brand-accent:    #F19B13  /* Orange accent */
--brand-highlight: #EAF066  /* Jaune surbrillance */
--brand-sand:      #E7C275  /* Beige sable */
```

## Installation

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

## Développement

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Utilisation des couleurs

### Dans Tailwind CSS

```tsx
<div className="bg-brand-primary text-white">
  <button className="btn-primary">Bouton</button>
</div>
```

### Dans CSS personnalisé

```css
.my-element {
  background-color: var(--brand-primary);
  color: var(--brand-accent);
}
```

## Structure

- `/app` - Pages et layouts Next.js
- `/components` - Composants React réutilisables
- `/public` - Fichiers statiques
- `globals.css` - Styles globaux avec variables de couleur
- `tailwind.config.ts` - Configuration Tailwind avec couleurs de marque

## API Backend

L'application se connecte automatiquement au backend FastAPI sur `http://localhost:8000` via le proxy Next.js.
