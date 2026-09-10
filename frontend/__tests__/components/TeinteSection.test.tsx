/**
 * La traînée de couleur ne doit pas gêner la lecture.
 *
 * Une première version posait une nappe radiale de 620 × 520 px sur la zone de
 * contenu : elle reliait bien la barre et la page, mais au prix de la
 * lisibilité. Ces tests fixent les garde-fous qui l'empêchent de revenir.
 */

import { render } from '@testing-library/react';

import TeinteSection from '@/components/TeinteSection';
import { accentDe } from '@/lib/accents';

let chemin = '/controle';

jest.mock('next/navigation', () => ({ usePathname: () => chemin }));
jest.mock('@/lib/sidebar-context', () => ({ useSidebar: () => ({ collapsed: false }) }));
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
}));

/** Barre latérale minimale portant un élément actif mesurable. */
function poserBarreLaterale({ hauteurElement = 32 } = {}) {
  document.body.innerHTML = `<aside><a data-actif="true">Analyse</a></aside>`;
  const barre = document.querySelector('aside')!;
  const actif = document.querySelector<HTMLElement>('[data-actif="true"]')!;
  barre.getBoundingClientRect = () => ({ right: 224, left: 0, top: 0, bottom: 900 }) as DOMRect;
  actif.getBoundingClientRect = () =>
    ({ top: 180, height: hauteurElement, left: 8, right: 210 }) as DOMRect;
}

function traînée() {
  return document.querySelector<HTMLElement>('[aria-hidden]');
}

describe('traînée de section', () => {
  beforeEach(() => {
    chemin = '/controle';
    poserBarreLaterale();
  });

  test("elle ne dépasse pas la hauteur de l'élément de menu", () => {
    render(<TeinteSection />);
    const hauteur = parseInt(traînée()!.style.height, 10);
    // 32 px d'élément plus un débord d'adoucissement, jamais une bande d'écran.
    expect(hauteur).toBeGreaterThan(32);
    expect(hauteur).toBeLessThan(80);
  });

  test("elle s'éteint avant le corps du contenu", () => {
    render(<TeinteSection />);
    expect(parseInt(traînée()!.style.width, 10)).toBeLessThanOrEqual(320);
  });

  test('elle suit la hauteur réelle de l\'élément', () => {
    poserBarreLaterale({ hauteurElement: 48 });
    render(<TeinteSection />);
    expect(parseInt(traînée()!.style.height, 10)).toBeGreaterThan(48);
  });

  test('elle ne capte aucun clic', () => {
    render(<TeinteSection />);
    expect(traînée()!.className).toContain('pointer-events-none');
  });

  test('elle multiplie plutôt que de voiler, pour ne pas délaver le texte', () => {
    // Multiplier un texte presque noir par une couleur claire le laisse noir ;
    // un voile en alpha normal lui ferait perdre du contraste.
    render(<TeinteSection />);
    expect(traînée()!.className).toContain('mix-blend-multiply');
  });

  test('aucune traînée sans élément actif marqué', () => {
    document.body.innerHTML = `<aside><a>Analyse</a></aside>`;
    render(<TeinteSection />);
    expect(traînée()).toBeNull();
  });

  test('aucune traînée sur la page de connexion', () => {
    chemin = '/login';
    render(<TeinteSection />);
    expect(traînée()).toBeNull();
  });
});

describe('teintes', () => {
  test('elles restent assez diluées pour laisser lire', () => {
    // La traînée est étroite et peu floutée : à teinte égale elle marque bien
    // plus qu'une nappe large. Au-delà de 0,20 la lecture souffrait.
    for (const chemin of ['/controle', '/colorimetrie', '/cuves', '/assistant', '/admin']) {
      const alpha = Number(accentDe(chemin).voile.match(/,\s*([\d.]+)\)$/)?.[1] ?? 0);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(0.2);
    }
  });
});
