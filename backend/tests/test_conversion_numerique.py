"""Conversion des valeurs d'un relevé en nombres exploitables.

Le défaut d'origine : ``isinstance(val, (int, float))`` est faux pour un
``numpy.int64``, qui n'hérite pas de ``int``. Un fichier dont toutes les
colonnes étaient entières voyait chacune de ses lignes écartée, et l'import
échouait sur « Pas assez de données numériques » — un message qui accuse
l'utilisateur d'avoir un fichier vide alors que le relevé est propre.

Le cas était intermittent : ``iterrows()`` promeut la ligne entière en
``float64`` dès qu'une seule colonne porte des décimales, ce qui masquait le
défaut sur la plupart des fichiers.
"""

import numpy as np
import pandas as pd
import pytest

import main
import pasto


class TestTypesNumeriques:

    @pytest.mark.parametrize("valeur, attendu", [
        (np.int64(20), 20.0),
        (np.int32(20), 20.0),
        (np.float64(20.5), 20.5),
        (np.float32(0.5), 0.5),
        (20, 20.0),
        (20.5, 20.5),
        (-3, -3.0),
        (0, 0.0),
    ])
    def test_scalaires_acceptes(self, valeur, attendu):
        assert main._clean_numeric(valeur) == pytest.approx(attendu)

    @pytest.mark.parametrize("valeur", [np.nan, float("nan"), pd.NA, None])
    def test_valeurs_manquantes_rejetees(self, valeur):
        assert main._clean_numeric(valeur) is None

    @pytest.mark.parametrize("valeur", [True, False, np.bool_(True)])
    def test_booleens_rejetes(self, valeur):
        # Une colonne de vrai/faux n'est ni un temps ni une température, et
        # bool est un sous-type de int : sans garde, True vaudrait 1 °C.
        assert main._clean_numeric(valeur) is None

    @pytest.mark.parametrize("valeur, attendu", [
        ("72,5", 72.5),
        ('"72.5"', 72.5),
        (" 72.5 ", 72.5),
        ("72,5 °C", 72.5),
    ])
    def test_chaines_toujours_gerees(self, valeur, attendu):
        assert main._clean_numeric(valeur) == pytest.approx(attendu)

    @pytest.mark.parametrize("valeur", ["", "abc", "n/a", "—"])
    def test_chaines_non_numeriques_rejetees(self, valeur):
        assert main._clean_numeric(valeur) is None


class TestImportColonnesEntieres:
    """Le test qui aurait arrêté le défaut."""

    def test_un_releve_entierement_en_entiers_est_lu(self):
        csv = "Time;Temp\n0;20\n5;65\n10;72\n15;72\n20;60\n"
        df = main._read_csv_robust(csv.encode("utf-8"))
        assert all(str(t).startswith("int") for t in df.dtypes)  # bien des entiers
        temps, temperatures, _ = main._extract_numeric_columns(df)
        assert temps == [0.0, 5.0, 10.0, 15.0, 20.0]
        assert temperatures == [20.0, 65.0, 72.0, 72.0, 60.0]

    def test_entiers_et_decimaux_donnent_la_meme_vp(self):
        entiers = "Temps (min);Température (°C)\n0;20\n5;65\n10;72\n15;72\n20;60\n"
        decimaux = "Temps (min);Température (°C)\n0.0;20.0\n5.0;65.0\n10.0;72.0\n15.0;72.0\n20.0;60.0\n"
        vps = []
        for csv in (entiers, decimaux):
            df = main._read_csv_robust(csv.encode("utf-8"))
            temps, temperatures, _ = main._extract_numeric_columns(df)
            vps.append(pasto.evaluer_pasteurisation(
                temperatures=temperatures, temps=temps,
                product_type="cidre_doux", unite_temps="minute",
            )["vp"])
        assert vps[0] == vps[1]
        assert vps[0] > 0

    def test_colonne_texte_surnumeraire_sans_effet(self):
        # Cas d'un export d'enregistreur : une colonne « Unité » entre les deux.
        df = pd.DataFrame({
            "Temps (min)": np.array([0, 5, 10], dtype=np.int64),
            "Unité": ["C", "C", "C"],
            "Température (°C)": np.array([20, 65, 72], dtype=np.int64),
        })
        temps, temperatures, _ = main._extract_numeric_columns(df)
        assert temps == [0.0, 5.0, 10.0]
        assert temperatures == [20.0, 65.0, 72.0]

    def test_lignes_incompletes_toujours_ecartees(self):
        # Le comportement de tri des lignes inexploitables ne doit pas changer.
        df = pd.DataFrame({
            "Temps (min)": [0, 5, None, 15],
            "Température (°C)": [20, 65, 72, None],
        })
        temps, temperatures, _ = main._extract_numeric_columns(df)
        assert temps == [0.0, 5.0]
        assert temperatures == [20.0, 65.0]
