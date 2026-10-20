"""Transcriptions OCR des illustrations : de la sortie de Tesseract au TOML.

Tesseract n'est pas appelé ici : on part de sa sortie TSV, écrite à la main
d'après une vraie fiche de variété (Armagnac, 1963). Ce qui est vérifié, c'est
que rien n'est perdu ni déformé en chemin — les valeurs restent telles
qu'imprimées, les lignes coupées sont recollées, les mots douteux suivent leur
valeur — et que le TOML se relit à l'identique.
"""

from __future__ import annotations

from ascocid.application.ingestion import transcriptions_images as ti
from ascocid.infrastructure.parsing.ocr import LigneOcr, lignes_depuis_tsv

ENTETE = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"


def tsv(lignes: list[tuple[int, int, str, float]]) -> str:
    """(bloc, paragraphe, texte, confiance) → TSV Tesseract, un mot par ligne."""
    sortie = [ENTETE]
    compteur: dict[tuple[int, int], int] = {}
    for bloc, par, texte, conf in lignes:
        numero = compteur[(bloc, par)] = compteur.get((bloc, par), 0) + 1
        for i, mot in enumerate(texte.split(), 1):
            c = conf if mot.endswith("*") or conf < 80 else 96.0
            sortie.append(f"5\t1\t{bloc}\t{par}\t{numero}\t{i}\t{10 * i}\t{20 * numero}\t9\t9\t{c}\t{mot}")
    return "\n".join(sortie)


ARMAGNAC = tsv([
    (1, 1, "Variété: ARMAGNAC", 95),
    (2, 1, "PRINCIPALES ZONES DE PRODUCTION", 95),
    (3, 1, "Aisne.", 95),
    (3, 1, "Seine-Maritime.", 95),
    (4, 1, "POSSIBILITES de COMMERCIALISATION en bonne année", 95),
    (5, 1, "Plantations diffuses souvent jeunes: il n'existe actuellement pas de", 95),
    (5, 1, "centres de production importants.", 95),
    (6, 1, "QUALITES TECHNOLOGIQUES DU FRUIT", 95),
    (6, 2, "(analyse de M. Tavernier le 15-12-51)", 95),
    (7, 1, "Rendement du jus (%) : 56,7.", 95),
    (7, 2, "Densité du jus : 1 065,5 - Alcool en puissance : 6° 2.", 95),
    (7, 3, "Acidité de titration en g. SO* H* par litre : 5,73.", 40),
    (8, 1, "QUALITES CULTURALES DE L'ARBRE", 95),
    (9, 1, "Résistance aux maladies : variété rustique d'une façon générale - peut", 95),
    (9, 1, "craindre les pucerons.", 95),
    (9, 2, "pH : environ 3.2-3.3", 95),
    (10, 1, "OBSERVATIONS DIVERSES", 95),
    (11, 1, "Très bonne variété pour l'industrie : donne un jus de haute densité.", 95),
    (12, 1, "Comité des Fruits à Cidre et des Productions Cidricoles", 95),
    (12, 2, "Edition 1963", 95),
])


def transcription() -> ti.TranscriptionImage:
    return ti.depuis_ocr(1416, "FDC_ARMAGNAC", "Armagnac", "abc", lignes_depuis_tsv(ARMAGNAC))


def rubrique(t: ti.TranscriptionImage, debut: str) -> ti.Rubrique:
    return next(r for r in t.rubriques if r.titre.upper().startswith(debut))


def test_lignes_regroupees_avec_leur_confiance():
    lignes = lignes_depuis_tsv(ARMAGNAC)
    acidite = next(l for l in lignes if l.texte.startswith("Acidité"))
    assert acidite.confiance == 40 and acidite.douteux
    assert next(l for l in lignes if l.texte == "Aisne.").douteux == []


def test_valeurs_telles_qu_imprimees():
    t = transcription()
    techno = rubrique(t, "QUALITES TECHNOLOGIQUES")
    valeurs = {l.intitule: l.valeur for l in techno.lignes}
    assert valeurs["Rendement du jus (%)"] == "56,7."
    # Deux valeurs sur une ligne : séparées, et sans conversion (« 6° 2 » reste tel quel).
    assert valeurs["Densité du jus"] == "1 065,5"
    assert valeurs["Alcool en puissance"] == "6° 2."
    assert techno.note == "analyse de M. Tavernier le 15-12-51"


def test_mots_douteux_suivent_leur_valeur():
    techno = rubrique(transcription(), "QUALITES TECHNOLOGIQUES")
    acidite = next(l for l in techno.lignes if l.intitule.startswith("Acidité"))
    assert acidite.valeur == "5,73." and acidite.douteux


def test_ligne_coupee_recollee_et_intitule_court_en_minuscule():
    culture = rubrique(transcription(), "QUALITES CULTURALES")
    valeurs = {l.intitule: l.valeur for l in culture.lignes}
    assert valeurs["Résistance aux maladies"] == (
        "variété rustique d'une façon générale - peut craindre les pucerons.")
    assert valeurs["pH"] == "environ 3.2-3.3"


def test_rubriques_redigees_ne_sont_pas_coupees_sur_les_deux_points():
    t = transcription()
    obs = rubrique(t, "OBSERVATIONS")
    assert obs.lignes[0].intitule == ""
    assert obs.lignes[0].valeur.startswith("Très bonne variété pour l'industrie : donne")
    commerce = rubrique(t, "POSSIBILITES")          # titre en casse mixte reconnu
    assert commerce.lignes[0].intitule == ""


def test_titre_et_pied_de_page():
    t = transcription()
    assert t.titre == "Armagnac"
    assert [l.valeur for l in rubrique(t, "SOURCE").lignes][-1] == "Edition 1963"


def test_toml_relu_a_l_identique(tmp_path):
    t = transcription()
    chemin = tmp_path / "FDC_ARMAGNAC.toml"
    chemin.write_text(ti.en_toml(t), encoding="utf-8")
    assert ti.charger(chemin) == t
    # Le texte brut, multi-lignes, ne doit pas atterrir dans la dernière rubrique.
    assert ti.charger(chemin).texte_ocr.startswith("Variété: ARMAGNAC\n")


def test_guillemets_et_antislash_survivent_au_toml(tmp_path):
    t = ti.TranscriptionImage(
        idoc=1, code="X", titre='Cidre « mixte » "test"', image_sha256="s",
        texte_ocr='ligne 1 \\ avec """ triple\nMicroorganismes \\"""\\"""""#a \x0c fin"\nligne 3',
        rubriques=[ti.Rubrique(titre="R", lignes=[ti.Ligne(intitule="a", valeur='b "c" \\ d')])])
    chemin = tmp_path / "x.toml"
    chemin.write_text(ti.en_toml(t), encoding="utf-8")
    assert ti.charger(chemin) == t


def test_ligne_ocr_sans_texte_ignoree():
    assert ti.structurer([LigneOcr(texte="  ", confiance=0)]) == ("", [])


# ── Point de départ livré avec le code ───────────────────────────────────────


def test_semer_amene_ce_qui_manque_sans_jamais_ecraser_une_relecture(tmp_path):
    livrees, volume = tmp_path / "livrees", tmp_path / "volume"
    livrees.mkdir()

    def ecrire(dossier, code, statut, valeur):
        ti.enregistrer(dossier, ti.TranscriptionImage(
            idoc=1, code=code, titre=code, image_sha256="s", statut=statut,
            rubriques=[ti.Rubrique(titre="R", lignes=[ti.Ligne(valeur=valeur)])]))

    for code in ("NOUVELLE", "NON_RELUE", "RELUE", "ILLISIBLE"):
        ecrire(livrees, code, "a_verifier", "version livrée")
    assert ti.semer(livrees, volume) == (4, 0)            # volume vide : tout est amené
    assert ti.semer(livrees, volume) == (0, 0)            # rien n'a changé : rien n'est refait

    (volume / "NOUVELLE.toml").unlink()
    ecrire(volume, "NON_RELUE", "a_verifier", "ancienne extraction")
    ecrire(volume, "RELUE", "valide", "corrigée par l'IFPC")
    (volume / "ILLISIBLE.toml").write_text("ceci n'est pas du TOML [", encoding="utf-8")

    assert ti.semer(livrees, volume) == (1, 1)
    valeur = lambda code: ti.charger(volume / f"{code}.toml").rubriques[0].lignes[0].valeur  # noqa: E731
    assert valeur("NOUVELLE") == "version livrée"
    assert valeur("NON_RELUE") == "version livrée"         # personne n'y avait touché
    assert valeur("RELUE") == "corrigée par l'IFPC"        # la relecture est intacte
    assert (volume / "ILLISIBLE.toml").read_text(encoding="utf-8").startswith("ceci n'est pas")


def test_semer_sans_copie_livree_ne_fait_rien(tmp_path):
    assert ti.semer(tmp_path / "absent", tmp_path / "volume") == (0, 0)


def test_les_transcriptions_livrees_se_chargent_toutes():
    from pathlib import Path

    dossier = Path(__file__).resolve().parent.parent / "config" / "transcriptions_initiales"
    erreurs: list[str] = []
    transcriptions = ti.charger_dossier(dossier, erreurs)
    assert erreurs == []
    assert len(transcriptions) >= 390
    assert {t.code.split("_", 1)[0] for t in transcriptions} >= {"FDC", "FICHE", "CMAP"}
