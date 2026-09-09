"""Gabarit du document de relecture client.

Reprend l'identité visuelle du document « Questions de référence » : même
client, même projet, même palette — les deux se lisent comme une série.
Les jetons @@NOM@@ sont substitués par `evaluer.rapport`.
"""

GABARIT = """<title>Relecture des réponses AsCoCid</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=Source+Sans+3:ital,wght@0,400;0,600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
  :root{
    --ground:#F6F7F3; --surface:#FFFFFF; --surface-sunk:#EFF1EA;
    --ink:#1A1F1A; --ink-soft:#454C44; --ink-mute:#6A7268;
    --rule:#DCE0D5; --rule-firm:#C3C9BA;
    --accent:#2F6B4A; --accent-wash:#E7F0E9;
    --amber:#8F6410; --amber-wash:#F5EEDD;
    --rust:#94382A; --rust-wash:#F6E7E3;
    --bleu:#2B5573; --bleu-wash:#E5EDF3;
    --shadow:0 1px 2px rgba(26,31,26,.05),0 8px 24px -18px rgba(26,31,26,.3);
  }
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --ground:#131612; --surface:#1B1F19; --surface-sunk:#22271F;
    --ink:#E9ECE4; --ink-soft:#C0C7BA; --ink-mute:#8F978A;
    --rule:#2C3229; --rule-firm:#3D453A;
    --accent:#82C29B; --accent-wash:#1E2C23;
    --amber:#D6A951; --amber-wash:#2C2618;
    --rust:#E29580; --rust-wash:#2E1F1B;
    --bleu:#8FB6D1; --bleu-wash:#1B2730;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -18px rgba(0,0,0,.8);
  }}
  :root[data-theme="dark"]{
    --ground:#131612; --surface:#1B1F19; --surface-sunk:#22271F;
    --ink:#E9ECE4; --ink-soft:#C0C7BA; --ink-mute:#8F978A;
    --rule:#2C3229; --rule-firm:#3D453A;
    --accent:#82C29B; --accent-wash:#1E2C23;
    --amber:#D6A951; --amber-wash:#2C2618;
    --rust:#E29580; --rust-wash:#2E1F1B;
    --bleu:#8FB6D1; --bleu-wash:#1B2730;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -18px rgba(0,0,0,.8);
  }
  *{box-sizing:border-box}
  body{background:var(--ground);color:var(--ink);
    font-family:"Source Sans 3",system-ui,sans-serif;font-size:16px;line-height:1.6}
  .page{max-width:880px;margin:0 auto;padding:52px 26px 90px}
  p{margin:0 0 1em;max-width:68ch}
  h1,h2{font-family:Newsreader,Georgia,serif;font-weight:600;
    text-wrap:balance;line-height:1.18;margin:0}
  h1{font-size:2.5rem;letter-spacing:-.012em}
  h2{font-size:1.4rem;margin:0 0 .5em}
  .eyebrow{font-family:"JetBrains Mono",monospace;font-size:.7rem;letter-spacing:.14em;
    text-transform:uppercase;color:var(--ink-mute);font-weight:600;display:block;
    margin-bottom:14px}
  header{border-bottom:2px solid var(--ink);padding-bottom:22px;margin-bottom:30px}
  .lede{font-family:Newsreader,Georgia,serif;font-size:1.2rem;line-height:1.5;
    color:var(--ink-soft);margin-top:.7em;max-width:60ch}

  .chiffres{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));
    gap:1px;background:var(--rule);border:1px solid var(--rule);margin:26px 0}
  .chiffre{background:var(--surface);padding:14px 16px}
  .chiffre b{display:block;font-family:"JetBrains Mono",monospace;font-size:1.35rem;
    font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
  .chiffre span{font-size:.78rem;color:var(--ink-mute);display:block;margin-top:3px}

  section{margin-top:40px}
  .consigne{background:var(--surface);border:1px solid var(--rule-firm);
    border-left:3px solid var(--accent);padding:18px 22px;margin:22px 0}
  .consigne p:last-child{margin-bottom:0}

  .q{background:var(--surface);border:1px solid var(--rule-firm);border-radius:3px;
    box-shadow:var(--shadow);margin:0 0 20px;padding:18px 22px 14px}
  .q-tete{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px}
  .id{font-family:"JetBrains Mono",monospace;font-size:.78rem;font-weight:600;
    color:var(--ink-mute)}
  .forme{font-family:"JetBrains Mono",monospace;font-size:.65rem;font-weight:600;
    letter-spacing:.09em;text-transform:uppercase;padding:3px 8px;border-radius:2px}
  .f-fait{color:var(--bleu);background:var(--bleu-wash)}
  .f-proc{color:var(--accent);background:var(--accent-wash)}
  .f-arb{color:var(--amber);background:var(--amber-wash)}
  .f-look{color:var(--ink-mute);background:var(--surface-sunk)}
  .f-non{color:var(--rust);background:var(--rust-wash)}
  .f-abr{color:var(--rust);background:var(--rust-wash)}
  .theme{font-size:.8rem;color:var(--ink-mute);margin-left:auto}
  .question{font-family:Newsreader,Georgia,serif;font-size:1.16rem;font-style:italic;
    line-height:1.4;margin:0 0 12px;color:var(--ink)}
  .reponse{background:var(--surface-sunk);border-radius:2px;padding:14px 16px;
    font-size:.97rem;line-height:1.62}
  .src-tag{font-family:"JetBrains Mono",monospace;font-size:.72em;color:var(--accent);
    background:var(--accent-wash);padding:1px 4px;border-radius:2px;white-space:nowrap}

  a.src-tag{text-decoration:none;border-bottom:1px solid transparent}
  a.src-tag:hover,a.src-tag:focus{border-bottom-color:var(--accent);outline:none}
  .src-tag.absente{color:var(--rust);background:var(--rust-wash)}

  .sources{margin-top:12px}
  .s-titre{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.08em;
    text-transform:uppercase;color:var(--ink-mute);font-weight:600;margin:0 0 8px}
  .source{border-left:2px solid var(--rule-firm);padding:2px 0 2px 12px;margin-bottom:10px}
  .source:target{border-left-color:var(--accent);background:var(--accent-wash);
    border-radius:0 2px 2px 0;padding-right:10px}
  .source.absente{border-left-color:var(--rust)}
  .s-tete{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;font-size:.9rem}
  .s-tete code{font-family:"JetBrains Mono",monospace;font-size:.72rem;font-weight:600;
    color:var(--accent);background:var(--accent-wash);padding:1px 5px;border-radius:2px}
  .s-tete a{color:var(--ink);font-weight:600;text-decoration:none;
    border-bottom:1px solid var(--rule-firm)}
  .s-tete a:hover,.s-tete a:focus{border-bottom-color:var(--accent);color:var(--accent)}
  .s-tete em{color:var(--ink-soft);font-size:.92em}
  .s-tete .idoc{font-family:"JetBrains Mono",monospace;font-size:.68rem;
    color:var(--ink-mute);margin-left:auto}
  .source blockquote{margin:6px 0 0;font-size:.88rem;line-height:1.55;
    color:var(--ink-soft)}
  .vide{color:var(--ink-mute);font-style:italic;font-size:.9rem}

  ul.alertes{list-style:none;margin:10px 0 0;padding:0;font-size:.87rem}
  ul.alertes li{padding:7px 12px;border-radius:2px;margin-bottom:5px}
  .al.bloq{background:var(--rust-wash);color:var(--rust);
    box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rust) 26%,transparent)}
  .al.avert{background:var(--amber-wash);color:var(--amber)}
  ul.alertes b{font-family:"JetBrains Mono",monospace;font-size:.8em}

  .verdict{margin-top:12px;padding-top:11px;border-top:1px dashed var(--rule-firm);
    display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:.87rem;
    color:var(--ink-soft)}
  .verdict > span:first-child{font-family:"JetBrains Mono",monospace;font-size:.68rem;
    letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);font-weight:600}
  .verdict label{display:inline-flex;gap:5px;align-items:center;white-space:nowrap}
  .commentaire{color:var(--ink-mute);flex-basis:100%;font-size:.85rem}

  footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--rule);
    color:var(--ink-mute);font-size:.86rem}

  @page{size:A4;margin:14mm 13mm}
  @media print{
    :root,:root[data-theme="dark"]{
      --ground:#FFF; --surface:#FFF; --surface-sunk:#F4F6F1;
      --ink:#14180F; --ink-soft:#3D443B; --ink-mute:#6A7268;
      --rule:#D5DACD; --rule-firm:#B4BBAA;
      --accent:#2A6042; --accent-wash:#EAF2EC;
      --amber:#7E5A0E; --amber-wash:#F6F0E0;
      --rust:#8A3325; --rust-wash:#F8EAE6;
      --bleu:#24506E; --bleu-wash:#E6EDF3; --shadow:none;
    }
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-size:10pt}
    .page{max-width:none;padding:0}
    h1{font-size:21pt}
    .q,.consigne,.chiffre{break-inside:avoid}
    .source blockquote{font-size:8.5pt;line-height:1.45}
    .s-tete .idoc{margin-left:8px}
    .q{box-shadow:none;margin-bottom:12px}
  }
  @media (max-width:600px){.page{padding:34px 16px 60px}h1{font-size:1.9rem}
    .theme{margin-left:0;flex-basis:100%}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="page">
<header>
  <span class="eyebrow">Livre de Connaissances AsCoCid &nbsp;·&nbsp; @@DATE@@</span>
  <h1>Relecture des réponses</h1>
  <p class="lede">@@N@@ questions posées au système, et ce qu'il a répondu.
  Votre relecture indique ce qui va, ce qui ne va pas, et ce qu'il faut reformuler.</p>
</header>

<div class="chiffres">
  <div class="chiffre"><b>@@N_REP@@ / @@N@@</b><span>réponses obtenues</span></div>
  <div class="chiffre"><b>@@PROPRES@@</b><span>sans alerte automatique</span></div>
  <div class="chiffre"><b>@@BLOQUEES@@</b><span>bloquée(s) par le contrôle</span></div>
  <div class="chiffre"><b>@@TTFT@@ s</b><span>délai avant réponse (médian)</span></div>
  <div class="chiffre"><b>@@COUT@@ $</b><span>coût des @@N@@ questions</span></div>
</div>

<section>
  <h2>Comment lire ce document</h2>
  <div class="consigne">
    <p><strong>Les questions sont de nous, les réponses sont du système.</strong> Nous
    les avons écrites à partir du contenu réel du Livre, en couvrant les onze diagrammes
    de procédé, de la récolte au post-conditionnement.</p>
    <p><strong>Ce qui nous serait le plus utile :</strong> pour chaque réponse, dire si
    elle est juste, incomplète, fausse ou à côté de la demande — et, quand la question
    elle-même sonne faux, la reformuler comme un producteur la poserait. C'est cette
    reformulation qui a le plus de valeur : elle nous dit comment on nous parle vraiment.</p>
    <p><strong>Les marqueurs</strong> <span class="src-tag">S2</span> sont cliquables :
    ils mènent au passage exact sur lequel la phrase s'appuie, reproduit sous chaque
    réponse. Le titre de la fiche ouvre la fiche complète dans AsCoCid. Un contrôle
    automatique vérifie par ailleurs que chaque chiffre cité figure bien dans un
    passage ; ses alertes sont signalées.</p>
  </div>
</section>

<section>
  <h2>Les @@N@@ questions</h2>
  @@FICHES@@
</section>

<footer>
  Réponses produites par le modèle @@MODELE@@ à partir des fiches du Livre de
  Connaissances AsCoCid (IFPC / INRAE). Coût moyen : @@COUT_Q@@ $ par question.
  Aucune réponse n'a été retouchée à la main.
</footer>
</div>
"""
