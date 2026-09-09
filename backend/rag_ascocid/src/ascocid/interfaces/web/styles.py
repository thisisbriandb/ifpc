"""Feuille de style du rendu façon AsCoCid.

Même palette que les livrables client — les trois documents se lisent comme une
série. La géométrie des zones cliquables, elle, est celle d'AsCoCid : carré de
24 px invisible, révélé à 0,5 d'opacité au survol.
"""

STYLES = """<title>Rendu façon AsCoCid</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=Source+Sans+3:ital,wght@0,400;0,600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
  :root{
    --ground:#F6F7F3; --surface:#FFFFFF; --surface-sunk:#EFF1EA;
    --ink:#1A1F1A; --ink-soft:#454C44; --ink-mute:#6A7268;
    --rule:#DCE0D5; --rule-firm:#C3C9BA;
    --accent:#2F6B4A; --accent-wash:#E7F0E9;
    --amber:#8F6410; --amber-wash:#F5EEDD;
    --rust:#94382A;
    --shadow:0 1px 2px rgba(26,31,26,.05),0 10px 30px -20px rgba(26,31,26,.35);
  }
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --ground:#131612; --surface:#1B1F19; --surface-sunk:#22271F;
    --ink:#E9ECE4; --ink-soft:#C0C7BA; --ink-mute:#8F978A;
    --rule:#2C3229; --rule-firm:#3D453A;
    --accent:#82C29B; --accent-wash:#1E2C23;
    --amber:#D6A951; --amber-wash:#2C2618; --rust:#E29580;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -20px rgba(0,0,0,.9);
  }}
  :root[data-theme="dark"]{
    --ground:#131612; --surface:#1B1F19; --surface-sunk:#22271F;
    --ink:#E9ECE4; --ink-soft:#C0C7BA; --ink-mute:#8F978A;
    --rule:#2C3229; --rule-firm:#3D453A;
    --accent:#82C29B; --accent-wash:#1E2C23;
    --amber:#D6A951; --amber-wash:#2C2618; --rust:#E29580;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -20px rgba(0,0,0,.9);
  }
  *{box-sizing:border-box}
  body{background:var(--ground);color:var(--ink);
    font-family:"Source Sans 3",system-ui,sans-serif;font-size:16px;line-height:1.62;
    margin:0;padding:44px 22px 80px}
  .demo{max-width:860px;margin:0 auto 44px}
  .demo-legende{font-size:.92rem;color:var(--ink-soft);background:var(--amber-wash);
    border-left:3px solid var(--amber);padding:11px 16px;margin:0 0 16px;
    border-radius:0 2px 2px 0}

  .fiche-ascocid{background:var(--surface);border:1px solid var(--rule-firm);
    border-radius:3px;box-shadow:var(--shadow);padding:26px 30px 20px}
  .code-fiche{font-family:"JetBrains Mono",monospace;font-size:.68rem;
    letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute);
    font-weight:600;margin:0 0 6px}
  .titre-fiche{font-family:Newsreader,Georgia,serif;font-size:2rem;font-weight:600;
    line-height:1.2;margin:0 0 18px;text-wrap:balance}

  /* ── Schéma et zones cliquables — géométrie reprise d'AsCoCid ───────────── */
  figure.cmap{position:relative;margin:0 0 20px;background:var(--surface-sunk);
    border:1px solid var(--rule);border-radius:2px;overflow:hidden}
  figure.cmap img{width:100%;height:auto;display:block}
  a.zone{position:absolute;border-radius:15%;opacity:0;cursor:pointer;
    background:var(--accent);transition:opacity .3s ease;
    box-shadow:0 6px 6px -6px rgba(0,0,0,.5)}
  a.zone:hover,a.zone:focus{opacity:.5;outline:none}
  /* L'étape citée par la réponse : visible en permanence, c'est notre apport. */
  a.zone.active{opacity:1;background:transparent;
    border:3px solid var(--rust);border-radius:20%;
    box-shadow:0 0 0 4px color-mix(in srgb,var(--rust) 22%,transparent),
               0 0 0 1px var(--surface) inset}
  figure.cmap figcaption,figure.illustration figcaption{
    font-size:.8rem;color:var(--ink-mute);padding:8px 12px;
    border-top:1px solid var(--rule);background:var(--surface)}
  figure.illustration{margin:0 0 20px;border:1px solid var(--rule);
    border-radius:2px;overflow:hidden}
  figure.illustration img{width:100%;height:auto;display:block}

  .corps h2{font-family:Newsreader,Georgia,serif;font-size:1.3rem;font-weight:600;
    margin:26px 0 8px;line-height:1.25}
  .corps p{margin:0 0 .9em;max-width:66ch}
  mark{background:color-mix(in srgb,var(--amber) 28%,transparent);
    color:inherit;padding:1px 2px;border-radius:2px;
    box-shadow:0 0 0 1px color-mix(in srgb,var(--amber) 40%,transparent)}

  section.motscles,section.voiraussi,section.biblio{margin-top:28px;
    padding-top:18px;border-top:1px solid var(--rule)}
  h3{font-family:"JetBrains Mono",monospace;font-size:.68rem;letter-spacing:.1em;
    text-transform:uppercase;color:var(--ink-mute);font-weight:600;margin:0 0 12px}
  .grille-termes{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));
    gap:6px}
  .grille-termes details{background:var(--surface-sunk);border-radius:2px;
    padding:7px 11px;font-size:.9rem}
  .grille-termes summary{cursor:pointer;font-weight:600;color:var(--accent)}
  .grille-termes summary::marker{color:var(--ink-mute)}
  .grille-termes p{margin:7px 0 0;font-size:.87rem;color:var(--ink-soft);line-height:1.5}

  section.voiraussi ul{list-style:none;margin:0;padding:0;
    display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px}
  section.voiraussi li{padding:4px 0;font-size:.93rem;display:flex;gap:8px;
    align-items:baseline}
  section.voiraussi a{color:var(--ink);text-decoration:none;
    border-bottom:1px solid var(--rule-firm)}
  section.voiraussi a:hover,section.voiraussi a:focus{color:var(--accent);
    border-bottom-color:var(--accent)}
  .corps-lien{font-family:"JetBrains Mono",monospace;font-size:.6rem;
    text-transform:uppercase;letter-spacing:.06em;color:var(--ink-mute);
    white-space:nowrap}
  section.biblio p{font-size:.88rem;color:var(--ink-soft);line-height:1.5;max-width:none}

  .pied-fiche{margin-top:26px;padding-top:14px;border-top:1px solid var(--rule);
    font-size:.82rem;color:var(--ink-mute);display:flex;flex-wrap:wrap;gap:12px;
    align-items:baseline}
  .pied-fiche .origine{margin-left:auto;color:var(--accent);text-decoration:none;
    font-weight:600;border-bottom:1px solid transparent;white-space:nowrap}
  .pied-fiche .origine:hover,.pied-fiche .origine:focus{border-bottom-color:var(--accent)}
  .vide{color:var(--ink-mute);font-style:italic}

  @media (max-width:620px){body{padding:28px 14px 60px}
    .fiche-ascocid{padding:20px 18px 16px}.titre-fiche{font-size:1.55rem}}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
@@CORPS@@
"""
