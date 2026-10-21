# Versions et mises en production

> `main` n'est plus la production. Une mise en production est une **version**
> numérotée, publiée sur GitHub (onglet *Releases* du dépôt IFPC-APPS/PADOC),
> avec ses notes. Revenir à la version précédente prend un clic.

## Le principe

```
feat/…  ──PR──▶  main  ──▶  PR « chore: version 1.4.0 »  ──merge──▶  tag v1.4.0 + Release
                  │          (tenue à jour automatiquement)                  │
                  ▼                                                          ▼
                 VM (tests de l'équipe)                         branche production
                                                                  ├─▶ Vercel (front)
                                                                  └─▶ Railway (Core API, assistant)
```

| Branche / tag | Rôle | Qui y écrit |
|---|---|---|
| `main` | intégration : on y merge les PR | l'équipe, par PR |
| `production` | **la seule branche déployée** par Vercel et Railway | le workflow « Versions » (et « Retour à une version ») |
| `vX.Y.Z` | une version publiée, sa page *Release* et ses notes | le workflow « Versions » |

## Publier une version

1. Les PR sont mergées sur `main` comme d'habitude. Les messages de commit
   suivent la convention déjà en usage :
   - `feat: …` → nouveauté → version **mineure** (1.3.0 → 1.4.0) ;
   - `fix: …` → correction → **correctif** (1.3.0 → 1.3.1) ;
   - `feat!: …` ou un pied `BREAKING CHANGE:` → **majeure** (1.3.0 → 2.0.0) ;
   - `chore:`, `docs:`, `test:`, `ci:`, `refactor:` → n'apparaissent pas dans les notes.
2. Après chaque merge dont la CI est verte, une PR **« chore: version X.Y.Z »**
   est créée ou mise à jour : elle contient le numéro et le `CHANGELOG.md`
   (rubriques *Nouveautés*, *Corrections*).
3. **Merger cette PR, c'est décider d'une mise en production.** La CI repasse ;
   si elle est verte, le tag `vX.Y.Z` et la *Release* sont publiés, la branche
   `production` avance sur ce commit, et Vercel et Railway déploient.

Tant que la PR de version n'est pas mergée, rien ne part en production : on
peut merger autant de PR que nécessaire sur `main` et les tester sur la VM.

> La PR de version est ouverte par GitHub Actions : la CI ne s'exécute pas sur
> elle (limite de GitHub pour les PR créées par un workflow), mais elle
> s'exécute au merge, et la publication l'attend.

## Revenir en arrière

Onglet **Actions → « Retour à une version » → Run workflow**, saisir la
version (ex. `v1.3.2`). La branche `production` est reposée sur cette version ;
Vercel et Railway la redéploient. `main` n'est pas touché : la correction s'y
fait, et sortira dans la version suivante.

## Savoir ce qui tourne

| Où | Comment |
|---|---|
| Front | en-tête de l'administration : « Version 1.4.0 » |
| Core API | `GET /api/deploy/info` → `"version"` (et le commit Railway) |
| Assistant | `GET /api/ldc/sante` → `"version"` |
| GitHub | onglet *Releases* : la dernière version et ses notes |

## La VM (tests de l'équipe)

La VM ne suit aucune branche automatiquement. Depuis un poste :

```bash
./scripts/deployer-vm.sh main      # tester l'état courant de main
./scripts/deployer-vm.sh v1.4.0    # remettre une version publiée
```

Le script refuse de déployer si la copie de la VM a été modifiée à la main.

## À régler une fois dans les tableaux de bord

Ces réglages ne sont pas dans le dépôt ; sans eux, Vercel et Railway
continuent de déployer `main`.

1. **Vercel** — projet du front → *Settings → Git* → **Production Branch :
   `production`**. Les autres branches, `main` compris, restent des
   prévisualisations.
2. **Railway** — services **Core API** et **assistant (rag_ascocid)** →
   *Settings → Source* → **Branch : `production`**.
3. **GitHub** — *Settings → Branches* : protéger `production` pour que seul
   GitHub Actions puisse y écrire (pas de push direct). *Settings →
   Environments → production* : facultatif, exiger une approbation avant chaque
   mise en production ou retour arrière.

## Première version

`release-please-config.json` force la première version à **1.0.0**
(`"release-as": "1.0.0"`) : PADOC est déjà en service, il ne repart pas de
0.x. **Retirer cette ligne après la publication de v1.0.0**, sinon chaque PR
de version proposerait 1.0.0.

Ordre conseillé — la branche `production` n'existe qu'après la première
publication, Vercel et Railway ne peuvent la suivre qu'ensuite :

1. merger ce changement sur `main` ;
2. merger la PR « chore: version 1.0.0 » qui apparaît : `v1.0.0` est publiée
   et la branche `production` créée ;
3. faire les réglages Vercel, Railway et GitHub ci-dessus ;
4. vérifier « Version 1.0.0 » dans l'administration et `/api/deploy/info` ;
5. retirer `"release-as": "1.0.0"` de `release-please-config.json`.
