"""Unité de la colonne temps : déclaration de l'opérateur contre horodatage.

Le défaut d'origine : un export d'enregistreur porte une colonne date/heure,
ramenée en minutes au parsing. L'unité déclarée par l'opérateur lui était
ensuite appliquée une seconde fois — et comme l'interface impose « seconde »
dès que le procédé est le flash, tout relevé de flash-pasteurisation importé
depuis un enregistreur produisait une VP soixante fois trop faible.
"""

from datetime import datetime

import pandas as pd
import pytest

import main
import pasto

# Palier 72 °C, relevé toutes les 5 minutes.
TEMPERATURES = [20.5, 65.2, 72.1, 72.0, 60.3]
MINUTES = [0.0, 5.0, 10.0, 15.0, 20.0]

LOGGER_CSV = [
    '"Nom de l\'enregistreur","DS1922E"',
    '"Date / Heure","Unité","Température (°C)"',
    '"25/09/2025 15:00:00","C","20.5"',
    '"25/09/2025 15:05:00","C","65.2"',
    '"25/09/2025 15:10:00","C","72.1"',
    '"25/09/2025 15:15:00","C","72.0"',
    '"25/09/2025 15:20:00","C","60.3"',
]


def _vp(temps, temperatures, unite):
    return pasto.evaluer_pasteurisation(
        temperatures=temperatures, temps=temps,
        product_type="cidre_doux", unite_temps=unite,
    )["vp"]


class TestUniteProduiteParLeParsing:
    """Chaque parseur annonce l'unité qu'il produit, ou None s'il l'ignore."""

    def test_horodatage_produit_des_minutes(self):
        rows = [(datetime(2025, 9, 25, 15, m), t)
                for m, t in zip([0, 5, 10, 15, 20], TEMPERATURES)]
        temps, temperatures, unite_source = main._datetime_rows_to_minutes(rows)
        assert unite_source == "minute"
        assert temps == MINUTES
        assert temperatures == TEMPERATURES

    def test_colonne_numerique_brute_laisse_l_unite_inconnue(self):
        df = pd.DataFrame({"Temps": MINUTES, "Température (°C)": TEMPERATURES})
        temps, temperatures, unite_source = main._extract_numeric_columns(df)
        assert unite_source is None
        assert temps == MINUTES

    def test_colonne_datetime_dans_un_tableur(self):
        df = pd.DataFrame({
            "Date / Heure": [datetime(2025, 9, 25, 15, m) for m in [0, 5, 10, 15, 20]],
            "Température (°C)": TEMPERATURES,
        })
        temps, temperatures, unite_source = main._extract_numeric_columns(df)
        assert unite_source == "minute"
        assert temps == MINUTES

    def test_texte_colle_au_format_enregistreur(self):
        temps, temperatures, unite_source = main._parse_pasted_text("\n".join(LOGGER_CSV))
        assert unite_source == "minute"
        assert temps == MINUTES

    def test_texte_colle_en_deux_colonnes_simples(self):
        colle = "\n".join(f"{t}\t{T}" for t, T in zip(MINUTES, TEMPERATURES))
        temps, temperatures, unite_source = main._parse_pasted_text(colle)
        assert unite_source is None
        assert temps == MINUTES


class TestUniteEffective:

    def test_l_horodatage_l_emporte_sur_la_declaration(self):
        assert main._unite_effective("seconde", "minute") == "minute"
        assert main._unite_effective("minute", "minute") == "minute"

    def test_la_declaration_s_applique_aux_releves_bruts(self):
        assert main._unite_effective("seconde", None) == "seconde"
        assert main._unite_effective("minute", None) == "minute"


class TestNonRegressionVP:
    """Le test qui aurait arrêté le défaut."""

    def test_un_releve_horodate_donne_la_meme_vp_quel_que_soit_le_procede(self):
        temps, temperatures, unite_source = main._parse_pasted_text("\n".join(LOGGER_CSV))
        # « seconde » est ce que l'interface impose pour une flash-pasteurisation.
        vp_flash = _vp(temps, temperatures, main._unite_effective("seconde", unite_source))
        vp_classique = _vp(temps, temperatures, main._unite_effective("minute", unite_source))
        assert vp_flash == vp_classique

    def test_la_vp_d_un_releve_horodate_est_bien_calculee_en_minutes(self):
        temps, temperatures, unite_source = main._parse_pasted_text("\n".join(LOGGER_CSV))
        vp = _vp(temps, temperatures, main._unite_effective("seconde", unite_source))
        assert vp == pytest.approx(10399.003, rel=1e-6)

    def test_la_declaration_reste_determinante_sur_un_releve_brut(self):
        # Un relevé numérique nu ne dit pas son unité : diviser par 60 est
        # alors le comportement attendu, pas un défaut.
        colle = "\n".join(f"{t}\t{T}" for t, T in zip(MINUTES, TEMPERATURES))
        temps, temperatures, unite_source = main._parse_pasted_text(colle)
        vp_min = _vp(temps, temperatures, main._unite_effective("minute", unite_source))
        vp_sec = _vp(temps, temperatures, main._unite_effective("seconde", unite_source))
        # La VP est arrondie à 4 décimales en interne : le facteur 60
        # amplifie cet arrondi, la tolérance en tient compte.
        assert vp_min == pytest.approx(vp_sec * 60.0, rel=1e-6)
