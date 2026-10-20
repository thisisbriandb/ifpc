"""Transcriptions des illustrations en image : du texte OCR à un TOML relisible.

Les fiches de variété d'AsCoCid (et quelques figures) ne sont qu'une image :
69 des 85 fiches FDC n'ont aucun texte en base. Ce module en fait une
transcription structurée — rubriques, paires « intitulé : valeur » — qui garde
le texte **tel qu'imprimé** (« 6° 2 », « 1 065,5 » : rien n'est converti), les
mots dont l'OCR doute, et un statut de relecture.

Le TOML est la source de vérité de ce qui est indexé ; l'image reste la
référence de ce qui est vrai. La page de relecture les montre côte à côte.

Décision de l'équipe : une transcription « à vérifier » est indexée tout de
suite, et remplacée quand elle est corrigée ou validée.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tomllib
from pathlib import Path

from pydantic import BaseModel, Field

from ascocid.application.ingestion import synchro
from ascocid.application.ingestion.chunking import MAX_CAR, Chunk, _decouper_long
from ascocid.infrastructure.parsing.ocr import LigneOcr

STATUTS = ("a_verifier", "corrige", "valide")
QUALITE_MIN = 75


class Ligne(BaseModel):
    intitule: str = ""                # vide : paragraphe libre
    valeur: str
    douteux: list[str] = Field(default_factory=list)


class Rubrique(BaseModel):
    titre: str = ""
    note: str = ""                    # « (analyse de M. Jacquin le 9 décembre 1964) »
    lignes: list[Ligne] = Field(default_factory=list)
    # Carte conceptuelle : les cases de la relation sont reliées par des
    # flèches — une suite (« la pomme dans l'arbre → au sol → … »).
    ordonnee: bool = False


class TranscriptionImage(BaseModel):
    idoc: int
    code: str
    titre: str
    image_sha256: str
    source: str = "ocr-tesseract"
    # Confiance moyenne de l'OCR, pondérée par les mots (0-100). En dessous de
    # QUALITE_MIN, la lecture est trop mauvaise (un tableau aux colonnes
    # mélangées) pour être indexée avant correction.
    qualite_ocr: float = 100.0
    statut: str = "a_verifier"
    verifie_par: str = ""
    verifie_le: str = ""
    rubriques: list[Rubrique] = Field(default_factory=list)
    texte_ocr: str = ""               # brut, pour la traçabilité
    # Ce que la lecture n'a pas su trancher (relations et colonnes en nombre
    # différent…) : la fiche attend alors sa relecture pour être indexée.
    anomalies: list[str] = Field(default_factory=list)

    @property
    def carte(self) -> bool:
        return self.code.startswith("CMAP_")

    @property
    def indexable(self) -> bool:
        if self.statut != "a_verifier":
            return True
        return self.qualite_ocr >= QUALITE_MIN and not self.anomalies

    @property
    def nb_douteux(self) -> int:
        return sum(len(l.douteux) for r in self.rubriques for l in r.lignes)


# ── Structuration ────────────────────────────────────────────────────────────

# « Densité du jus : 1048,6 - Alcool en puissance : 6° 2. » porte deux valeurs.
COUPURE_PAIRES = re.compile(r"\s+-\s+(?=[A-ZÉÈÀÂ][^:]{1,40}\s*:)")
PAIRE = re.compile(r"^([A-ZÉÈÀÂÎÔÛÇ][^:]{1,55}?)\s*:\s*(.*)$")
# Intitulé en minuscule (« pH : environ 3.2 ») : accepté s'il est court, pour ne
# pas couper une phrase rédigée sur son premier « : ».
PAIRE_COURTE = re.compile(r"^((?:\S+\s?){1,4}?)\s*:\s*(.*)$")
NUMEROTEE = re.compile(r"^\d+(\.\d+)*\.?\s+\S")
PIED = re.compile(r"^(Comité des Fruits|Edition \d{4}|Fiche élaborée|Version du)", re.I)
# Rubriques où le texte est rédigé : un « : » n'y annonce pas une valeur
# (« Très bonne variété pour l'industrie : donne un jus… »).
REDIGEES = ("OBSERVATIONS", "ZONES DE PRODUCTION", "COMMERCIALISATION")


def _est_titre(texte: str) -> bool:
    if ":" in texte or len(texte) > 80:
        return False
    lettres = [c for c in texte if c.isalpha()]
    if len(lettres) >= 6 and sum(c.isupper() for c in lettres) / len(lettres) > 0.8:
        return True                                    # « QUALITES CULTURALES DE L'ARBRE »
    premier = texte.split()[0]
    if len(premier) >= 6 and premier.isupper():
        return True                                    # « POSSIBILITES de COMMERCIALISATION »
    return bool(NUMEROTEE.match(texte)) and len(texte) <= 60  # « 3.1 Récolte »


def structurer(lignes: list[LigneOcr]) -> tuple[str, list[Rubrique]]:
    """(titre lu sur la fiche, rubriques). Le titre est vide s'il n'est pas lu."""
    titre = ""
    rubriques: list[Rubrique] = []
    courante = Rubrique()
    source = Rubrique(titre="Source")
    paragraphe_precedent = -1

    def fermer() -> None:
        nonlocal courante
        if courante.lignes or courante.note or courante.titre:
            rubriques.append(courante)
        courante = Rubrique()

    for l in lignes:
        texte = l.texte.strip()
        if not texte:
            continue
        m = re.match(r"^Vari[ée]t[ée]\s*:\s*(.+)$", texte)
        if m and not titre:
            titre = m.group(1).strip()
            continue
        if PIED.match(texte):
            source.lignes.append(Ligne(valeur=texte, douteux=l.douteux))
            continue
        if _est_titre(texte):
            fermer()
            courante.titre = texte
            paragraphe_precedent = -1
            continue
        if texte.startswith("(") and texte.endswith(")") and not courante.lignes:
            courante.note = texte[1:-1].strip()
            continue

        redigee = any(mot in courante.titre.upper() for mot in REDIGEES)
        morceaux = [texte] if redigee else COUPURE_PAIRES.split(texte)
        for i, morceau in enumerate(morceaux):
            paire = None if redigee else (PAIRE.match(morceau) or PAIRE_COURTE.match(morceau))
            continuation = (i == 0 and paire is None and courante.lignes
                            and l.paragraphe == paragraphe_precedent)
            if paire:
                courante.lignes.append(Ligne(intitule=paire.group(1).strip(),
                                             valeur=paire.group(2).strip(), douteux=l.douteux))
            elif continuation:
                derniere = courante.lignes[-1]
                derniere.valeur = f"{derniere.valeur} {morceau}".strip()
                derniere.douteux += l.douteux
            else:
                courante.lignes.append(Ligne(valeur=morceau, douteux=l.douteux))
        paragraphe_precedent = l.paragraphe
    fermer()
    if source.lignes:
        rubriques.append(source)
    return titre, rubriques


def depuis_carte(idoc: int, code: str, titre_fiche: str, svg_sha256: str, lue,  # noqa: ANN001
                 version_ocr: str = "") -> TranscriptionImage:
    """Une carte lue (`infrastructure/parsing/carte_svg`) en transcription relisible."""
    rubriques = [Rubrique(titre=r.libelle, ordonnee=r.ordonnee,
                          # Sous-case d'une carte à deux niveaux : son parent en intitulé.
                          lignes=[Ligne(intitule=e.parent, valeur=e.texte, douteux=e.douteux)
                                  for e in r.elements])
                 for r in lue.relations]
    source = lue.source + (f" (tesseract {version_ocr})" if lue.source != "svg" and version_ocr else "")
    texte = "\n".join([lue.notion] + [f"{r.libelle} : " + " | ".join(e.texte for e in r.elements)
                                     for r in lue.relations])
    return TranscriptionImage(
        idoc=idoc, code=code, titre=titre_fiche or lue.notion, image_sha256=svg_sha256,
        source=source, qualite_ocr=round(lue.qualite, 1), rubriques=rubriques,
        texte_ocr=texte, anomalies=lue.anomalies)


def depuis_ocr(idoc: int, code: str, titre_fiche: str, image_sha256: str,
               lignes: list[LigneOcr], version_ocr: str = "") -> TranscriptionImage:
    titre_lu, rubriques = structurer(lignes)
    mots = sum(l.nb_mots for l in lignes)
    qualite = (sum(l.confiance_moyenne * l.nb_mots for l in lignes) / mots) if mots else 0.0
    return TranscriptionImage(
        qualite_ocr=round(qualite, 1),
        idoc=idoc, code=code, titre=titre_fiche or titre_lu, image_sha256=image_sha256,
        source=f"ocr-tesseract{f' {version_ocr}' if version_ocr else ''}",
        rubriques=rubriques, texte_ocr="\n".join(l.texte for l in lignes),
    )


# ── TOML ─────────────────────────────────────────────────────────────────────


def _chaine(valeur: str) -> str:
    # Une chaîne JSON est une chaîne TOML valide (mêmes échappements) ; le
    # texte multi-lignes passe en """ pour rester lisible à la relecture.
    if "\n" in valeur:
        # Chaque guillemet est échappé, pas seulement les triples : l'OCR
        # produit des suites (« """"" ») qui fermeraient la chaîne. Les
        # caractères de contrôle (hors saut de ligne et tabulation) aussi.
        corps = valeur.replace("\\", "\\\\").replace('"', '\\"')
        corps = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", lambda m: f"\\u{ord(m.group()):04x}", corps)
        return '"""\n' + corps + '"""'
    return json.dumps(valeur, ensure_ascii=False)


def en_toml(t: TranscriptionImage) -> str:
    lignes = [
        f"# Transcription de l'illustration de la fiche {t.idoc} (AsCoCid).",
        "# Produite par OCR ; l'image reste la référence. Statuts : a_verifier, corrige, valide.",
        "",
        f"idoc = {t.idoc}",
        f"code = {_chaine(t.code)}",
        f"titre = {_chaine(t.titre)}",
        f"image_sha256 = {_chaine(t.image_sha256)}",
        f"source = {_chaine(t.source)}",
        f"qualite_ocr = {t.qualite_ocr}",
        f"statut = {_chaine(t.statut)}",
        f"verifie_par = {_chaine(t.verifie_par)}",
        f"verifie_le = {_chaine(t.verifie_le)}",
        # Avant les tables : en TOML, une clé écrite après [[rubriques]] leur appartiendrait.
        f"texte_ocr = {_chaine(t.texte_ocr)}",
    ]
    if t.anomalies:
        lignes.append("anomalies = [" + ", ".join(_chaine(a) for a in t.anomalies) + "]")
    for r in t.rubriques:
        lignes += ["", "[[rubriques]]", f"titre = {_chaine(r.titre)}"]
        if r.note:
            lignes.append(f"note = {_chaine(r.note)}")
        if r.ordonnee:
            lignes.append("ordonnee = true")
        for l in r.lignes:
            lignes += ["", "[[rubriques.lignes]]"]
            if l.intitule:
                lignes.append(f"intitule = {_chaine(l.intitule)}")
            lignes.append(f"valeur = {_chaine(l.valeur)}")
            if l.douteux:
                lignes.append("douteux = [" + ", ".join(_chaine(d) for d in l.douteux) + "]")
    lignes.append("")
    return "\n".join(lignes)


def charger(chemin: str | Path) -> TranscriptionImage:
    with Path(chemin).open("rb") as f:
        return TranscriptionImage(**tomllib.load(f))


def charger_dossier(dossier: str | Path,
                    erreurs: list[str] | None = None) -> list[TranscriptionImage]:
    """Toutes les transcriptions lisibles du dossier.

    Contrairement aux schémas (vérifiés en CI), ces fichiers sont modifiés par
    la relecture : un fichier illisible est écarté et noté dans `erreurs`,
    plutôt que d'empêcher le service de démarrer.
    """
    dossier = Path(dossier)
    if not dossier.exists():
        return []
    sortie = []
    for chemin in sorted(dossier.glob("*.toml")):
        try:
            sortie.append(charger(chemin))
        except Exception as exc:  # noqa: BLE001 — TOML ou modèle invalide
            if erreurs is None:
                raise
            erreurs.append(f"{chemin.name} : illisible, écarté ({type(exc).__name__}: {exc})")
    return sortie


# ── Passages pour l'index ────────────────────────────────────────────────────

TYPE_CHUNK = "illustration"
CLE_META = "transcriptions_images"
# À incrémenter quand la mise en phrases change : les passages sont alors
# régénérés au prochain démarrage, même si aucune transcription n'a bougé.
VERSION_REDACTION = "1"


def passages(t: TranscriptionImage) -> list[tuple[str, str]]:
    """(section, texte) : un passage par rubrique, la source rappelée en tête.

    Les valeurs sont recopiées telles quelles : la vérification des réponses
    compare les chiffres cités au texte des passages, caractère pour caractère.
    """
    if t.carte:
        return _passages_carte(t)
    source = " ".join(l.valeur for r in t.rubriques if r.titre == "Source" for l in r.lignes)
    sortie = []
    for r in t.rubriques:
        if r.titre == "Source" or not r.lignes:
            continue
        lignes = [f"Fiche « {t.titre} »" + (f" — {r.titre}" if r.titre else "")
                  + (f" ({r.note})" if r.note else "") + "."]
        lignes += [f"{l.intitule} : {l.valeur}" if l.intitule else l.valeur for l in r.lignes]
        if source:
            lignes.append(f"Source : {source}")
        sortie.append((r.titre or "Fiche", "\n".join(lignes)))
    return sortie


def _passages_carte(t: TranscriptionImage) -> list[tuple[str, str]]:
    """Une carte conceptuelle : une phrase par relation, et une vue d'ensemble.

    « La clarification haute classique a pour causes d'échec : … ». Le titre
    de la fiche (exact) sert de sujet, plutôt que la notion lue sur la carte
    (que l'OCR a pu abîmer).
    """
    phrases = []
    for r in t.rubriques:
        # Une ligne avec intitulé est le détail d'une case (son intitulé) :
        # « A (détail : x ; y) ».
        details: dict[str, list[str]] = {}
        for l in r.lignes:
            if l.intitule and l.valeur.strip():
                details.setdefault(l.intitule, []).append(l.valeur)
        elements = []
        for l in r.lignes:
            if l.intitule or not l.valeur.strip():
                continue
            sous = details.pop(l.valeur, [])
            elements.append(l.valeur + (f" (détail : {' ; '.join(sous)})" if sous else ""))
        # Un détail dont le parent n'est plus dans la liste (après une correction) reste dit.
        elements += [f"{parent} : {' ; '.join(sous)}" for parent, sous in details.items()]
        if not elements:
            continue
        lien = " → " if r.ordonnee else " ; "
        phrases.append((r.titre, f"« {t.titre} » {r.titre}" + (" (dans l'ordre)" if r.ordonnee else "")
                        + " : " + lien.join(elements) + "."))
    if not phrases:
        return []
    ensemble = (f"Carte conceptuelle « {t.titre} » du Livre de Connaissances.\n"
                + "\n".join(texte for _, texte in phrases))
    return [("Carte conceptuelle", ensemble)] + phrases


def empreinte(transcriptions: list[TranscriptionImage]) -> str:
    h = hashlib.sha256(VERSION_REDACTION.encode())
    for t in sorted(transcriptions, key=lambda x: x.code):
        h.update(t.model_dump_json().encode())
    return h.hexdigest()


def construire(transcriptions: list[TranscriptionImage], magasin,  # noqa: ANN001
               ) -> tuple[list[Chunk], list[str]]:
    """Chunks de toutes les transcriptions dont la fiche existe ; et les anomalies."""
    titres = {r["idoc"]: r["titre"] for r in magasin.cx.execute("SELECT idoc, titre FROM fiche")}
    sortie: list[Chunk] = []
    anomalies: list[str] = []
    for t in transcriptions:
        if t.idoc not in titres:
            anomalies.append(f"{t.code} : fiche {t.idoc} absente du corpus — ignorée.")
            continue
        if not t.indexable:
            continue                    # lecture trop mauvaise : attend sa correction
        n = 0
        for section, texte in passages(t):
            for morceau in (_decouper_long(texte) if len(texte) > MAX_CAR else [texte]):
                ordre = 20_000 + n                     # après les chunks propres et les schémas
                n += 1
                h = hashlib.sha256(f"illustration:{t.idoc}:{ordre}:{morceau}".encode()).hexdigest()[:16]
                sortie.append(Chunk(
                    cle=f"ascocid://illustration/{h}", fiche_idoc=t.idoc, ordre=ordre,
                    type=TYPE_CHUNK, titre_fiche=titres[t.idoc], titre_section=section,
                    texte=morceau))
    return sortie, anomalies


def synchroniser(transcriptions: list[TranscriptionImage], magasin,  # noqa: ANN001
                 embedder=None, index=None) -> tuple[int | None, list[str]]:  # noqa: ANN001
    return synchro.synchroniser(
        magasin, TYPE_CHUNK, CLE_META, empreinte(transcriptions),
        lambda: construire(transcriptions, magasin), embedder, index,
        vide=not transcriptions)


# ── Relecture ────────────────────────────────────────────────────────────────


def enregistrer(dossier: str | Path, t: TranscriptionImage) -> None:
    """Écrit la transcription ; fichier temporaire puis renommage, jamais à moitié."""
    chemin = Path(dossier) / f"{t.code}.toml"
    tmp = chemin.with_suffix(".tmp")
    tmp.write_text(en_toml(t), encoding="utf-8")
    os.replace(tmp, chemin)


def remplacer_une(t: TranscriptionImage, toutes: list[TranscriptionImage], magasin,  # noqa: ANN001
                  embedder=None, index=None) -> int:  # noqa: ANN001
    """Après une correction : ne refait que les passages de cette fiche.

    Revectoriser toutes les illustrations à chaque correction prendrait une
    minute ; une fiche, une seconde. L'empreinte de l'ensemble est remise à jour
    pour que le prochain démarrage n'ait rien à refaire.
    """
    anciennes = magasin.retirer_chunks_de_type(TYPE_CHUNK, t.idoc)
    if index is not None:
        index.retirer(anciennes)
    nouveaux, _ = construire([t], magasin)
    magasin.ecrire_chunks(nouveaux)
    avec_vecteurs = embedder is not None and index is not None
    if avec_vecteurs and nouveaux:
        index.ajouter([c.cle for c in nouveaux],
                      embedder.encoder([c.texte_indexe for c in nouveaux]))
    magasin.ecrire_meta(CLE_META, empreinte(toutes) + ("" if avec_vecteurs else ":lexical"))
    return len(nouveaux)
