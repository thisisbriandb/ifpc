/**
 * Le référentiel du frontend suit le document, comme celui du moteur.
 *
 * L'aide au choix du barème calcule entièrement côté client, à partir d'une
 * copie TypeScript des paramètres micro-organismes. Deux copies d'une table de
 * sécurité sanitaire tenues à la main dérivent tôt ou tard, et rien ne le
 * signalerait : le barème proposerait des temps de maintien fondés sur des
 * valeurs que le moteur n'emploie plus.
 *
 * Ce test lit les mêmes tableaux markdown que `backend/tests/test_referentiel.py`,
 * de sorte que le document reste l'unique source de vérité pour les deux.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  MICROORGANISMES,
  PRODUITS,
  ALIAS_PRODUITS,
  ALIAS_MICROORGANISMES,
  PRODUCT_MICROS,
  normaliserProduit,
  normaliserMicroorganisme,
} from '@/lib/referentiel';

const REFERENTIEL = join(__dirname, '..', '..', '..', 'referentiel-scientifique.md');

/** Lignes de données du premier tableau suivant un titre de section. */
function lireTableau(titreSection: string): string[][] {
  const texte = readFileSync(REFERENTIEL, 'utf-8');
  const depart = texte.indexOf(titreSection);
  if (depart === -1) throw new Error(`section introuvable : ${titreSection}`);

  const lignes: string[][] = [];
  let dansLeTableau = false;
  for (const brute of texte.slice(depart).split('\n').slice(1)) {
    const ligne = brute.trim();
    if (ligne.startsWith('|')) {
      dansLeTableau = true;
      const cellules = ligne.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      // Ignorer la ligne de séparation (| :--- | ---: | …)
      if (!cellules.every((c) => /^[:\- ]*$/.test(c))) lignes.push(cellules);
    } else if (dansLeTableau) {
      break;
    }
  }
  return lignes.slice(1); // sans l'en-tête
}

const cle = (cellule: string) => cellule.replace(/`/g, '').trim();
const nombre = (cellule: string) => parseFloat(cellule.replace(',', '.').trim());

interface MicroDocumente { nom: string; t_ref: number; d_ref: number; z: number; vp_cible: number }

const MICRO_DOCUMENTES: Record<string, MicroDocumente> = Object.fromEntries(
  lireTableau('### 4.1.').map((l) => [
    cle(l[0]),
    { nom: l[1], t_ref: nombre(l[2]), d_ref: nombre(l[3]), z: nombre(l[4]), vp_cible: nombre(l[5]) },
  ]),
);

interface ProduitDocumente { nom: string; micro: string; vp_cible: number }

const PRODUITS_DOCUMENTES: Record<string, ProduitDocumente> = Object.fromEntries(
  lireTableau('### 4.2.').map((l) => [
    cle(l[0]),
    { nom: l[1], micro: cle(l[2]), vp_cible: nombre(l[3]) },
  ]),
);

describe('lecture du document', () => {
  test('les deux tableaux sont lus', () => {
    expect(Object.keys(MICRO_DOCUMENTES)).toHaveLength(8);
    expect(Object.keys(PRODUITS_DOCUMENTES)).toHaveLength(3);
  });
});

describe('micro-organismes', () => {
  test('aucune entrée en trop ni manquante', () => {
    expect(Object.keys(MICROORGANISMES).sort()).toEqual(Object.keys(MICRO_DOCUMENTES).sort());
  });

  test.each(Object.keys(MICRO_DOCUMENTES).sort())('%s — paramètres conformes au document', (k) => {
    const code = MICROORGANISMES[k];
    const doc = MICRO_DOCUMENTES[k];
    expect(code.nom).toBe(doc.nom);
    expect(code.t_ref).toBeCloseTo(doc.t_ref, 6);
    expect(code.d_ref).toBeCloseTo(doc.d_ref, 6);
    expect(code.z).toBeCloseTo(doc.z, 6);
    expect(code.vp_cible).toBeCloseTo(doc.vp_cible, 6);
  });
});

describe('produits', () => {
  test('aucun produit en trop ni manquant', () => {
    expect(Object.keys(PRODUITS).sort()).toEqual(Object.keys(PRODUITS_DOCUMENTES).sort());
  });

  test.each(Object.keys(PRODUITS_DOCUMENTES).sort())('%s — conforme au document', (k) => {
    expect(PRODUITS[k].nom).toBe(PRODUITS_DOCUMENTES[k].nom);
    expect(PRODUITS[k].micro).toBe(PRODUITS_DOCUMENTES[k].micro);
    expect(PRODUITS[k].vp_cible).toBeCloseTo(PRODUITS_DOCUMENTES[k].vp_cible, 6);
  });

  test('les types hérités sont ramenés à leur entrée', () => {
    expect(normaliserProduit('cidre_demi_sec')).toBe('cidre_doux');
    expect(normaliserProduit('cidre_extra_brut')).toBe('cidre_brut');
    for (const cible of Object.values(ALIAS_PRODUITS)) {
      expect(PRODUITS_DOCUMENTES[cible]).toBeDefined();
    }
  });
});

describe('cibles du mode expert (§4.3)', () => {
  test.each(Object.keys(PRODUCT_MICROS))('%s — toute cible proposée existe au référentiel', (produit) => {
    for (const micro of PRODUCT_MICROS[produit]) {
      expect(MICRO_DOCUMENTES[micro]).toBeDefined();
    }
  });

  test.each(Object.keys(PRODUITS_DOCUMENTES))('%s — la cible de référence est proposée en premier', (produit) => {
    expect(PRODUCT_MICROS[produit][0]).toBe(PRODUITS_DOCUMENTES[produit].micro);
  });

  test('une clé de micro-organisme héritée reste résoluble', () => {
    // Des analyses enregistrées portent encore « alicyclo_res ».
    expect(normaliserMicroorganisme('alicyclo_res')).toBe('alicyclo_std');
    for (const cible of Object.values(ALIAS_MICROORGANISMES)) {
      expect(MICRO_DOCUMENTES[cible]).toBeDefined();
    }
  });

  test('le jus de pomme propose les quatre cibles que le moteur évalue', () => {
    // Le moteur évalue byssochlamys_fulva, alicyclo_std, saccharo_jus, ecoli.
    // La liste proposait alicyclo_res, entrée jumelle jamais évaluée : l'écart
    // était sans effet numérique, mais l'interface n'annonçait pas ce que le
    // moteur fait.
    expect(PRODUCT_MICROS.jus_pomme.slice(0, 4).sort()).toEqual(
      ['alicyclo_std', 'byssochlamys_fulva', 'ecoli', 'saccharo_jus'],
    );
  });
});

describe('cohérence interne du document', () => {
  test.each(Object.keys(MICRO_DOCUMENTES).sort())('%s — VP cible = 15 × D (§3.1)', (k) => {
    expect(MICRO_DOCUMENTES[k].vp_cible).toBeCloseTo(15 * MICRO_DOCUMENTES[k].d_ref, 6);
  });

  test.each(Object.keys(PRODUITS_DOCUMENTES).sort())('%s — cible identique à celle de sa souche', (k) => {
    expect(PRODUITS_DOCUMENTES[k].vp_cible).toBeCloseTo(
      MICRO_DOCUMENTES[PRODUITS_DOCUMENTES[k].micro].vp_cible, 6,
    );
  });
});
