"""Reconnaissance des colonnes temps / température à l'import d'un relevé.

Le défaut d'origine : « Temps » contient « temp », si bien que les deux
colonnes d'un fichier aux intitulés français se résolvaient vers la colonne
temps. La VP était alors calculée en prenant les instants pour des
températures — soit 0 UP et un verdict « insuffisant » sur un lot sain, sans
le moindre message d'erreur.
"""

import pandas as pd
import pytest

import main
import pasto


def _df(intitule_temps, intitule_temp):
    return pd.DataFrame({
        intitule_temps: [0.0, 5.0, 10.0, 15.0, 20.0],
        intitule_temp: [20.5, 65.2, 72.1, 72.0, 60.3],
    })


class TestClassementIntitules:
    """Chaque intitulé ne reçoit qu'un rôle, le signal le plus spécifique gagne."""

    @pytest.mark.parametrize("intitule", [
        "Température (°C)", "temperature", "Temp", "Temp.", "T° produit",
        "Temp (°C)", "Celsius", "Degré C", "Température minimale",
    ])
    def test_intitules_temperature(self, intitule):
        assert main._classer_colonne(intitule) == "temperature"

    @pytest.mark.parametrize("intitule", [
        "Temps (min)", "temps", "Time", "Durée", "Duree (min)",
        "Date / Heure", "Heure", "Minutes", "temps_sec",
    ])
    def test_intitules_temps(self, intitule):
        assert main._classer_colonne(intitule) == "temps"

    @pytest.mark.parametrize("intitule", ["Cuve", "N° lot", "Unité", ""])
    def test_intitules_non_reconnus(self, intitule):
        assert main._classer_colonne(intitule) is None

    def test_temperature_min_ne_bascule_pas_vers_le_temps(self):
        # « min » est un mot-clé de temps, mais le signal température est plus fort.
        assert main._classer_colonne("Temp min") == "temperature"
        assert main._classer_colonne("Température max") == "temperature"


class TestDetectionColonnes:

    @pytest.mark.parametrize("entetes", [
        ("Temps (min)", "Température (°C)"),
        ("temps", "temperature"),
        ("Temps", "Température"),
        ("Time", "Temp"),
        ("Time (s)", "Temperature (C)"),
        ("Durée (min)", "Temp. produit"),
        ("Date / Heure", "Température (°C)"),
    ])
    def test_les_deux_colonnes_sont_distinctes(self, entetes):
        temps_col, temp_col = main._detect_columns(_df(*entetes))
        assert temps_col == entetes[0]
        assert temp_col == entetes[1]
        assert temps_col != temp_col

    def test_ordre_des_colonnes_indifferent(self):
        df = pd.DataFrame({"Température (°C)": [20.5, 65.2], "Temps (min)": [0.0, 5.0]})
        temps_col, temp_col = main._detect_columns(df)
        assert temps_col == "Temps (min)"
        assert temp_col == "Température (°C)"

    def test_colonnes_supplementaires_ignorees(self):
        df = pd.DataFrame({
            "Date / Heure": [0.0, 5.0],
            "Unité": ["C", "C"],
            "Température (°C)": [20.5, 65.2],
        })
        assert main._detect_columns(df) == ("Date / Heure", "Température (°C)")

    def test_repli_positionnel_sans_intitule_reconnu(self):
        df = pd.DataFrame({"col_0": [0.0, 5.0], "col_1": [20.5, 65.2]})
        assert main._detect_columns(df) == ("col_0", "col_1")

    def test_refus_quand_un_seul_role_est_reconnu(self):
        # Deviner l'autre colonne produirait une VP fausse et silencieuse :
        # une erreur explicite vaut mieux.
        df = pd.DataFrame({"Temps (min)": [0.0, 5.0], "Cuve": [1, 2], "Volume": [10, 20]})
        with pytest.raises(ValueError, match="température"):
            main._detect_columns(df)


class TestNonRegressionVP:
    """Le test qui aurait arrêté le défaut : mêmes données, mêmes résultats."""

    def test_entetes_francais_et_anglais_donnent_la_meme_vp(self):
        vps = []
        for entetes in [("Temps (min)", "Température (°C)"), ("Time", "Temp")]:
            temps, temperatures, _ = main._extract_numeric_columns(_df(*entetes))
            resultat = pasto.evaluer_pasteurisation(
                temperatures=temperatures, temps=temps,
                product_type="cidre_doux", unite_temps="minute",
            )
            vps.append(resultat["vp"])
        assert vps[0] == vps[1]
        assert vps[0] > 0

    def test_la_colonne_temperature_n_est_pas_la_colonne_temps(self):
        temps, temperatures, _ = main._extract_numeric_columns(
            _df("Temps (min)", "Température (°C)")
        )
        assert temps == [0.0, 5.0, 10.0, 15.0, 20.0]
        assert temperatures == [20.5, 65.2, 72.1, 72.0, 60.3]

    def test_import_csv_francais_de_bout_en_bout(self):
        csv = (
            "Temps (min);Température (°C)\n"
            "0.0;20.5\n5.0;65.2\n10.0;72.1\n15.0;72.0\n20.0;60.3\n"
        )
        df = main._read_csv_robust(csv.encode("utf-8"))
        temps, temperatures, _ = main._extract_numeric_columns(df)
        resultat = pasto.evaluer_pasteurisation(
            temperatures=temperatures, temps=temps,
            product_type="cidre_doux", unite_temps="minute",
        )
        assert resultat["vp"] == pytest.approx(10399.003, rel=1e-6)
        assert resultat["statut"] == "conforme"
