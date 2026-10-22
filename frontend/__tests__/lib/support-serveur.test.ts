/**
 * @jest-environment node
 */
import {
  traiterDemande,
  supportActif,
  neutraliser,
  oublierEnvois,
  DEMANDES_PAR_HEURE,
  TITRE_MAX,
} from '@/lib/support-serveur';

const ENV = { ...process.env };

const demande = {
  categorie: 'BUG',
  titre: 'Le graphique ne s’affiche pas',
  description: 'Sur la page des cuves, rien ne s’affiche.',
  page: '/cuves',
  version: '0.3.0',
};

const requete = (corps: unknown, jeton: string | null = 'Bearer jeton-utilisateur') =>
  new Request('http://localhost/api/support/demandes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: jeton } : {}) },
    body: JSON.stringify(corps),
  });

const json = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status });

const moi = { firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@cidrerie.fr', companyName: 'Cidrerie' };

/** Simule le Core API, GitHub et Resend ; garde trace des appels. */
function simuler({ github = [json(201, { number: 42, html_url: 'https://github.com/IFPC-APPS/PADOC/issues/42' })],
  me = json(200, moi) }: { github?: Response[]; me?: Response } = {}) {
  const appels: { url: string; init?: RequestInit }[] = [];
  global.fetch = jest.fn(async (url: any, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/me')) return me.clone();
    if (String(url).startsWith('https://api.github.com')) return github.shift()!;
    return json(200, { id: 'mail' });
  }) as any;
  return appels;
}

type Appel = { url: string; init?: RequestInit };
const versGithub = (appels: Appel[]) => appels.filter((a) => a.url.startsWith('https://api.github.com'));

describe('help desk (fonctions Vercel)', () => {
  beforeEach(() => {
    process.env = { ...ENV, SUPPORT_GITHUB_TOKEN: 'jeton-github', SPRING_URL: 'http://core:8080', RESEND_API_KEY: 'cle' };
    oublierEnvois();
    // Les refus simulés sont journalisés : attendu, mais bruyant.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => { process.env = ENV; });

  test('sans jeton GitHub, le help desk est fermé et ne contacte personne', async () => {
    delete process.env.SUPPORT_GITHUB_TOKEN;
    const appels = simuler();

    expect(supportActif()).toBe(false);
    expect((await traiterDemande(requete(demande))).status).toBe(503);
    expect(appels).toHaveLength(0);
  });

  test("crée l'issue, prévient le service informatique, et renvoie le numéro", async () => {
    const appels = simuler();

    const r = await traiterDemande(requete(demande));

    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ numero: 42, url: 'https://github.com/IFPC-APPS/PADOC/issues/42' });

    // Le demandeur est reconnu avec SON jeton, par le Core API.
    expect(appels[0].url).toBe('http://core:8080/api/auth/me');
    expect((appels[0].init?.headers as any).Authorization).toBe('Bearer jeton-utilisateur');

    const [github] = versGithub(appels);
    expect(github.url).toBe('https://api.github.com/repos/IFPC-APPS/PADOC/issues');
    const issue = JSON.parse(github.init!.body as string);
    expect(issue.title).toBe('[Problème] Le graphique ne s’affiche pas');
    expect(issue.labels).toEqual(['help-desk', 'bug']);
    expect(issue.body).toContain('`/cuves`');

    const mail = appels.find((a) => a.url === 'https://api.resend.com/emails')!;
    const contenu = JSON.parse(mail.init!.body as string);
    expect(contenu.subject).toContain('#42');
    expect(contenu.html).toContain('jean.dupont@cidrerie.fr');
  });

  test("l'issue, publique, ne porte jamais l'identité du demandeur", async () => {
    const appels = simuler();
    await traiterDemande(requete(demande));

    const issue = versGithub(appels)[0].init!.body as string;
    expect(issue).not.toContain('jean.dupont');
    expect(issue).not.toContain('Dupont');
  });

  test("sans compte connecté, ou jeton refusé par le Core API : 401, rien n'est créé", async () => {
    let appels = simuler();
    expect((await traiterDemande(requete(demande, null))).status).toBe(401);
    expect(versGithub(appels)).toHaveLength(0);

    appels = simuler({ me: new Response(null, { status: 401 }) });
    expect((await traiterDemande(requete(demande))).status).toBe(401);
    expect(versGithub(appels)).toHaveLength(0);
  });

  test('demande incomplète ou trop longue : 400 avant GitHub', async () => {
    const appels = simuler();
    for (const invalide of [
      { ...demande, categorie: 'AUTRE' },
      { ...demande, titre: ' ' },
      { ...demande, description: '' },
      { ...demande, titre: 'x'.repeat(TITRE_MAX + 1) },
    ]) {
      expect((await traiterDemande(requete(invalide))).status).toBe(400);
    }
    expect(versGithub(appels)).toHaveLength(0);
  });

  test('étiquettes refusées (422) : la demande repart sans elles', async () => {
    const appels = simuler({ github: [json(422, {}), json(201, { number: 7, html_url: 'u' })] });

    const r = await traiterDemande(requete(demande));

    expect(r.status).toBe(201);
    const envois = versGithub(appels);
    expect(envois).toHaveLength(2);
    expect(JSON.parse(envois[1].init!.body as string).labels).toBeUndefined();
  });

  test('GitHub refuse : 502, sans détail technique pour l’écran', async () => {
    simuler({ github: [json(401, { message: 'Bad credentials' })] });

    const r = await traiterDemande(requete(demande));

    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain('credentials');
  });

  test("l'e-mail en échec ne fait pas échouer une demande déjà créée", async () => {
    simuler();
    global.fetch = jest.fn(async (url: any) => {
      if (String(url).endsWith('/api/auth/me')) return json(200, moi);
      if (String(url).startsWith('https://api.github.com')) return json(201, { number: 3, html_url: 'u' });
      throw new Error('Resend injoignable');
    }) as any;

    expect((await traiterDemande(requete(demande))).status).toBe(201);
  });

  test('au-delà de cinq demandes par heure et par compte : 429', async () => {
    simuler({ github: Array.from({ length: DEMANDES_PAR_HEURE }, () => json(201, { number: 1, html_url: 'u' })) });

    for (let i = 0; i < DEMANDES_PAR_HEURE; i++) {
      expect((await traiterDemande(requete(demande))).status).toBe(201);
    }
    expect((await traiterDemande(requete(demande))).status).toBe(429);
  });

  test('une mention @compte ne notifie personne sur GitHub', () => {
    expect(neutraliser('merci @thisisbriandb')).toBe('merci @​thisisbriandb');
    expect(neutraliser('prix @ 3 €')).toBe('prix @ 3 €');
  });
});
