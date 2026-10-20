"""Le sens des schémas d'AsCoCid, rendu cherchable.

Sur les pages de procédé, la connaissance est **dans le dessin** : l'ordre des
étapes, ce qui passe de l'une à l'autre (« moûts bruts »), les branches (la
clarification basse mène à la concentration), les procédés annexes. Rien de
cela n'est dans le texte de la page, qui se limite à la liste des liens ; et le
SVG ne le livre pas non plus — une centaine de fragments de texte dans le
désordre, et des flèches qui ne disent pas quel bloc elles relient.

Une reconstruction géométrique automatique des flèches serait fragile et
produirait, sans le signaler, des enchaînements faux — le pire défaut pour un
outil d'aide à la décision. Les schémas sont peu nombreux (13) et changent
rarement : chacun est donc **transcrit** une fois, dans un fichier versionné
(`config/schemas/*.toml`), à partir des libellés exacts du SVG, puis relu par
l'IFPC. Ce module en fait des passages en langue naturelle — « après
l'extraction des moûts vient… » — rattachés à la fiche du schéma, donc cités et
vérifiables comme le reste.

Chaque transcription porte l'empreinte du SVG transcrit : si AsCoCid modifie le
schéma, la différence est signalée au lieu de passer inaperçue.
"""

from __future__ import annotations

import hashlib
import tomllib
from collections.abc import Iterable
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

from ascocid.application.ingestion import synchro
from ascocid.application.ingestion.chunking import MAX_CAR, Chunk, _decouper_long

TYPE_CHUNK = "schema"
# À incrémenter quand la mise en phrases change : les passages sont alors
# régénérés au prochain démarrage, même si aucune transcription n'a bougé.
VERSION_REDACTION = "1"
CLE_META = "schemas"


# ── Transcription ────────────────────────────────────────────────────────────


class Redige(BaseModel):
    """Un passage rédigé à partir d'un schéma."""

    section: str
    texte: str
    # Indexé mais jamais montré au modèle : des synonymes de recherche
    # (« extraction du jus ») aident à retrouver le passage sans rien affirmer.
    contexte: str = ""


class Etape(BaseModel):
    id: str
    libelle: str
    fiche: int | None = None          # fiche détaillée (zone cliquable du schéma)
    precision: str = ""               # mention portée sur le schéma : « (ralentie) »
    groupe: str = ""                  # cadre englobant : « Extraction avec rémiage »
    variantes: list[str] = Field(default_factory=list)
    intrants: list[str] = Field(default_factory=list)   # ajouté à l'étape : « Calcium »
    synonymes: list[str] = Field(default_factory=list)  # pour la recherche seulement


class Transition(BaseModel):
    de: str = ""                      # vide : entrée du schéma
    vers: str = ""                    # vide : sortie du schéma
    produit: str = ""                 # le cadre jaune entre les deux
    condition: str = ""               # « en cas de re-croissance »
    # Flèche de retour en arrière (une boucle) : dite par celui qui transcrit,
    # parce que la deviner d'après le dessin se trompe — dans l'assemblage, la
    # vraie boucle est validation → formulation, pas formulation → essai.
    retour: bool = False


class Rattachement(BaseModel):
    """Procédé annexe ou valorisation de coproduits, relié en pointillés."""

    etapes: list[str]
    nature: str                       # « annexe » | « coproduit »
    libelle: str
    elements: list[str] = Field(default_factory=list)


class Chaine(BaseModel):
    """Graphe d'influence : une suite de causes et d'effets."""

    maillons: list[str]
    contexte: str = ""                # « Clarification réussie », « Clarification échec »


class Transcription(BaseModel):
    idoc: int
    code: str
    titre: str
    svg_sha256: str
    relecture: str = ""               # « Nom, date » une fois relue par l'IFPC
    note: str = ""
    etapes: list[Etape] = Field(default_factory=list)
    transitions: list[Transition] = Field(default_factory=list)
    rattachements: list[Rattachement] = Field(default_factory=list)
    chaines: list[Chaine] = Field(default_factory=list)

    @model_validator(mode="after")
    def _references(self) -> Transcription:
        ids = [e.id for e in self.etapes]
        doublons = {i for i in ids if ids.count(i) > 1}
        if doublons:
            raise ValueError(f"{self.code} : étapes en double {sorted(doublons)}")
        connus = set(ids) | {""}
        for t in self.transitions:
            for ref in (t.de, t.vers):
                if ref not in connus:
                    raise ValueError(f"{self.code} : transition vers une étape inconnue « {ref} »")
        for r in self.rattachements:
            for ref in r.etapes:
                if ref not in connus:
                    raise ValueError(f"{self.code} : rattachement à une étape inconnue « {ref} »")
        return self

    def etape(self, id_: str) -> Etape:
        return next(e for e in self.etapes if e.id == id_)


def charger(dossier: str | Path) -> list[Transcription]:
    """Toutes les transcriptions du dossier ; une erreur de saisie arrête tout.

    Mieux vaut refuser de démarrer sur une transcription incohérente que
    d'indexer un enchaînement faux.
    """
    dossier = Path(dossier)
    if not dossier.exists():
        return []
    transcriptions = []
    for chemin in sorted(dossier.glob("*.toml")):
        with chemin.open("rb") as f:
            transcriptions.append(Transcription(**tomllib.load(f)))
    return transcriptions


def schemas_modifies(transcriptions: Iterable[Transcription], manifeste: dict) -> list[str]:
    """Schémas dont le SVG collecté n'est plus celui qui a été transcrit."""
    alertes = []
    for t in transcriptions:
        actuel = manifeste.get(f"{t.idoc}:img")
        if actuel and actuel != t.svg_sha256:
            alertes.append(f"{t.code} : le schéma a changé dans AsCoCid depuis sa "
                           f"transcription — la relire (config/schemas).")
    return alertes


# ── Mise en phrases ──────────────────────────────────────────────────────────


def ordre(t: Transcription) -> list[Etape]:
    """Étapes dans l'ordre du procédé : tri topologique, à égalité l'ordre du fichier.

    Les retours en arrière (une boucle « en cas de re-croissance ») sont
    ignorés pour le tri : ils ne changent pas l'ordre de lecture.
    """
    # Les retours déclarés (`retour = true`) sont écartés d'emblée. Une boucle
    # non déclarée est repérée par un parcours en profondeur depuis l'entrée
    # (une arête vers une étape encore « en cours » de parcours la ferme), et
    # non d'après l'ordre du fichier, qui n'a pas à suivre le procédé.
    suivants: dict[str, list[str]] = {e.id: [] for e in t.etapes}
    for tr in t.transitions:
        if tr.de and tr.vers and not tr.retour:
            suivants[tr.de].append(tr.vers)
    debuts = [tr.vers for tr in t.transitions if not tr.de and tr.vers]
    retours: set[tuple[str, str]] = set()
    etat: dict[str, str] = {}

    def parcourir(noeud: str) -> None:
        etat[noeud] = "en_cours"
        for s in suivants[noeud]:
            if etat.get(s) == "en_cours":
                retours.add((noeud, s))
            elif s not in etat:
                parcourir(s)
        etat[noeud] = "fini"

    for depart in debuts + [e.id for e in t.etapes]:
        if depart not in etat:
            parcourir(depart)

    entrants: dict[str, set[str]] = {e.id: set() for e in t.etapes}
    for tr in t.transitions:
        if tr.de and tr.vers and not tr.retour and (tr.de, tr.vers) not in retours:
            entrants[tr.vers].add(tr.de)
    vus: list[str] = []
    restants = [e.id for e in t.etapes]
    while restants:
        prete = next((i for i in restants if entrants[i] <= set(vus)), restants[0])
        vus.append(prete)
        restants.remove(prete)
    return [t.etape(i) for i in vus]


def _nom(e: Etape) -> str:
    return f"« {e.libelle}{f' {e.precision}' if e.precision else ''} »"


def _designation(e: Etape) -> str:
    """« l'étape « Râpage » », mais « « Étape fermentaire » » sans redite."""
    return _nom(e) if e.libelle.lower().startswith(("étape", "etape")) else f"l'étape {_nom(e)}"


DEBUT, FIN = "\x00debut", "\x00fin"


def _facultative(t: Transcription, e: Etape) -> bool:
    """L'étape peut-elle être contournée, là où elle se trouve ?

    Question locale : de l'une de ses étapes précédentes, peut-on rejoindre
    l'une de ses suivantes sans y passer ? La question globale (« peut-on
    finir le schéma sans elle ? ») se trompe dans un schéma à méthodes
    parallèles : la fermentation primaire, obligatoire dans la méthode FR,
    serait dite facultative parce que la méthode FI s'en passe. Et une étape
    aux entrées toutes conditionnelles (la fermentation reçoit des moûts bruts,
    clarifiés OU concentrés) reste un passage obligé.
    """
    suivants: dict[str, list[str]] = {}
    for tr in t.transitions:
        if not tr.retour:
            suivants.setdefault(tr.de or DEBUT, []).append(tr.vers or FIN)
    avant = {tr.de or DEBUT for tr in t.transitions if tr.vers == e.id and not tr.retour}
    apres = {tr.vers or FIN for tr in t.transitions if tr.de == e.id and not tr.retour}
    for depart in avant:
        a_voir, vus = [s for s in suivants.get(depart, []) if s != e.id], set()
        while a_voir:
            courant = a_voir.pop()
            if courant in apres:
                return True
            if courant in vus or courant == FIN:
                continue
            vus.add(courant)
            a_voir += [s for s in suivants.get(courant, []) if s != e.id]
    return False


def _liste(elements: list[str]) -> str:
    return " ; ".join(elements)


def _synonymes(e: Etape) -> str:
    return f"Aussi appelé : {_liste(e.synonymes)}." if e.synonymes else ""


def _passages_procede(t: Transcription, detail: bool = False) -> list[Redige]:
    """(titre de section, texte) — une vue d'ensemble, puis un passage par étape."""
    etapes = ordre(t)
    passages: list[Redige] = []

    # 1. Vue d'ensemble : l'enchaînement complet, numéroté.
    lignes = [f"Schéma « {t.titre} » du Livre de Connaissances : enchaînement des "
              f"étapes, dans l'ordre du procédé."]
    entrees = [tr.produit for tr in t.transitions if not tr.de and tr.produit]
    if entrees:
        lignes.append(f"Au départ : {_liste(list(dict.fromkeys(entrees)))}.")
    for n, e in enumerate(etapes, 1):
        ligne = f"{n}. {e.libelle}"
        if e.precision:
            ligne += f" {e.precision}"
        if _facultative(t, e):
            ligne += " (selon le cas)"
        if e.groupe:
            ligne += f" — {e.groupe}"
        if e.variantes:
            ligne += f" — variantes : {_liste(e.variantes)}"
        if e.intrants:
            ligne += f" — intrants : {_liste(e.intrants)}"
        sorties =[tr.produit for tr in t.transitions if tr.de == e.id and tr.produit]
        if sorties:
            ligne += f" — produit : {_liste(list(dict.fromkeys(sorties)))}"
        lignes.append(ligne + ".")
    finales = [tr.produit for tr in t.transitions if not tr.vers and tr.produit]
    if finales:
        lignes.append(f"À l'arrivée : {_liste(list(dict.fromkeys(finales)))}.")
    passages.append(Redige(section="Enchaînement des étapes", texte="\n".join(lignes)))

    # 2. Une étape : ce qui la précède, ce qui la suit, et toute la suite.
    for e in etapes:
        phrases = [f"Dans le schéma « {t.titre} » : {_designation(e)}."]
        passages.append(Redige(
            section=e.libelle, contexte=_synonymes(e),
            texte=" ".join(phrases + _phrases_etape(t, e, etapes, avec_suite=not detail))))
    return passages


def _phrases_etape(t: Transcription, e: Etape, etapes: list[Etape],
                   avec_suite: bool = True) -> list[str]:
    """Ce qu'on sait d'une étape : variantes, intrants, avant, après, la suite.

    `avec_suite` : la liste de toutes les étapes restantes. Utile dans un
    schéma d'ensemble ; dans un schéma de détail, répétée à chaque étape, elle
    n'est que du bruit qui fait remonter tous ses passages sur le mot « étapes ».
    """
    position = {x.id: i for i, x in enumerate(etapes)}
    phrases: list[str] = []
    if e.groupe:
        phrases.append(f"Elle fait partie de : {e.groupe}.")
    if e.variantes:
        phrases.append(f"Elle se décline en : {_liste(e.variantes)}.")
    if e.intrants:
        phrases.append(f"Intrants ajoutés à cette étape : {_liste(e.intrants)}.")

    avant = [tr for tr in t.transitions if tr.vers == e.id]
    for tr in avant:
        origine = _designation(t.etape(tr.de)) if tr.de else "l'entrée du procédé"
        phrase = f"Elle vient après {origine}"
        if tr.produit:
            phrase += f", dont elle reçoit : {tr.produit}"
        if tr.condition:
            phrase += f" ({tr.condition})"
        phrases.append(phrase + ".")

    apres = [tr for tr in t.transitions if tr.de == e.id]
    for tr in apres:
        if tr.vers:
            phrase = f"Elle est suivie de {_designation(t.etape(tr.vers))}"
        else:
            phrase = "C'est la fin du schéma"
        if tr.produit:
            phrase += f" ; produit transmis : {tr.produit}"
        if tr.condition:
            phrase += f" ({tr.condition})"
        phrases.append(phrase + ".")

    suite = [x.libelle + (" (selon le cas)" if _facultative(t, x) else "")
             for x in etapes if position[x.id] > position[e.id]]
    if suite and avec_suite:
        phrases.append("Étapes suivantes, jusqu'à la fin du schéma : "
                       + " → ".join(suite) + ".")

    for r in t.rattachements:
        if e.id in r.etapes:
            genre = "Procédé annexe" if r.nature == "annexe" else "Coproduits"
            detail = f" : {_liste(r.elements)}" if r.elements else ""
            phrases.append(f"{genre} — {r.libelle}{detail}.")
    return phrases


def _passages_influence(t: Transcription) -> list[Redige]:
    passages = []
    for c in t.chaines:
        if len(c.maillons) < 2:
            continue
        texte = f"Graphe d'influence « {t.titre} »"
        if c.contexte:
            texte += f" — {c.contexte}"
        texte += f" : {c.maillons[0]}"
        for maillon in c.maillons[1:]:
            texte += f", qui entraîne : {maillon}"
        passages.append(Redige(section=c.contexte or "Chaîne de causes", texte=texte + "."))
    return passages


def passages(t: Transcription, detail: bool = False) -> list[Redige]:
    resultat = _passages_procede(t, detail) if t.etapes else []
    resultat += _passages_influence(t)
    if t.note:
        resultat.append(Redige(section="Note", texte=f"Schéma « {t.titre} » : {t.note}"))
    return resultat


def passages_de_liaison(transcriptions: list[Transcription]) -> dict[int, list[Redige]]:
    """Ce qui entoure un schéma de détail, vu depuis le schéma qui l'englobe.

    Le schéma « Extraction des moûts » décrit ce qui se passe *pendant*
    l'extraction ; ce qui la *suit* n'est écrit que dans le diagramme général.
    Sans ce passage, la question « quelles étapes suivent l'extraction ? »
    remonte d'abord le détail de l'extraction, dont la fiche porte le même nom,
    et la réponse arrive en fin de liste — ou n'y arrive pas.
    """
    detailles = {t.idoc: t for t in transcriptions}
    liens: dict[int, list[Redige]] = {}
    for englobant in transcriptions:
        etapes = ordre(englobant)
        for e in englobant.etapes:
            detail = detailles.get(e.fiche) if e.fiche != englobant.idoc else None
            if detail is None:
                continue
            texte = " ".join(
                [f"Le schéma « {detail.titre} » détaille {_designation(e)} du schéma "
                 f"« {englobant.titre} »."] + _phrases_etape(englobant, e, etapes))
            liens.setdefault(detail.idoc, []).append(Redige(
                section=f"Place dans le schéma « {englobant.titre} »", texte=texte,
                contexte=_synonymes(e)))
    return liens


def chunks(t: Transcription, titre_fiche: str | None = None,
           supplementaires: Iterable[Redige] = ()) -> list[Chunk]:
    """Passages d'un schéma, prêts pour l'index, rattachés à sa fiche.

    Un schéma accompagné de passages de liaison est le détail d'une étape
    d'un autre schéma : ses passages d'étape sont rédigés en conséquence.
    """
    supplementaires = list(supplementaires)
    sortie: list[Chunk] = []
    for redige in supplementaires + passages(t, detail=bool(supplementaires)):
        texte = redige.texte
        for morceau in (_decouper_long(texte) if len(texte) > MAX_CAR else [texte]):
            ordre_ = 10_000 + len(sortie)           # après les chunks propres de la fiche
            h = hashlib.sha256(f"schema:{t.idoc}:{ordre_}:{morceau}".encode()).hexdigest()[:16]
            sortie.append(Chunk(
                cle=f"ascocid://schema/{h}", fiche_idoc=t.idoc, ordre=ordre_,
                type=TYPE_CHUNK, titre_fiche=titre_fiche or t.titre,
                titre_section=redige.section, texte=morceau, contexte=redige.contexte,
            ))
    return sortie


# ── Synchronisation avec la base et l'index ──────────────────────────────────


def empreinte(transcriptions: Iterable[Transcription]) -> str:
    h = hashlib.sha256(VERSION_REDACTION.encode())
    for t in sorted(transcriptions, key=lambda x: x.code):
        h.update(t.model_dump_json().encode())
    return h.hexdigest()


def construire(transcriptions: list[Transcription], magasin) -> tuple[list[Chunk], list[str]]:  # noqa: ANN001
    """Chunks de toutes les transcriptions dont la fiche existe ; et les anomalies."""
    titres = {r["idoc"]: r["titre"] for r in magasin.cx.execute("SELECT idoc, titre FROM fiche")}
    liens = passages_de_liaison(transcriptions)
    resultat: list[Chunk] = []
    anomalies: list[str] = []
    for t in transcriptions:
        if t.idoc not in titres:
            anomalies.append(f"{t.code} : fiche {t.idoc} absente du corpus — schéma ignoré.")
            continue
        resultat.extend(chunks(t, titres[t.idoc], liens.get(t.idoc, [])))
    return resultat, anomalies


def synchroniser(transcriptions: list[Transcription], magasin,  # noqa: ANN001
                 embedder=None, index=None) -> tuple[int | None, list[str]]:  # noqa: ANN001
    """Remplace les passages des schémas si les transcriptions ont changé."""
    return synchro.synchroniser(
        magasin, TYPE_CHUNK, CLE_META, empreinte(transcriptions),
        lambda: construire(transcriptions, magasin), embedder, index,
        vide=not transcriptions)
