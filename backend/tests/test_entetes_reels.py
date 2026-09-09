"""En-têtes réellement produits par les enregistreurs du terrain.

Retour testeur : « dès que l'utilisateur importe un fichier avec un en-tête
différent de "Date / Heure" et "Température", erreur ».

La détection exige aujourd'hui qu'une colonne porte un mot-clé de température.
Or les exports d'enregistreurs nomment couramment la mesure « Valeur »,
« Voie 1 », « Value » ou « CH1 » — sans jamais dire qu'il s'agit d'une
température, celle-ci étant l'unique grandeur mesurée par l'appareil.

Ces tests décrivent ce que l'import doit accepter, et ce qu'il doit continuer
de refuser. Refuser reste le bon comportement quand l'ambiguïté est réelle :
une colonne prise pour une autre produit une VP fausse et silencieuse.
"""

import pandas as pd
import pytest

import main

TEMPS = [0.0, 5.0, 10.0, 15.0, 20.0]
TEMPERATURES = [20.5, 65.2, 72.1, 72.0, 60.3]


def _df(entetes, colonnes=None):
    return pd.DataFrame(dict(zip(entetes, colonnes or [TEMPS, TEMPERATURES])))


class TestEntetesExplicites:
    """Les deux colonnes se nomment : rien à deviner."""

    @pytest.mark.parametrize("entetes", [
        ("Date / Heure", "Température (°C)"),
        ("Temps (min)", "Température (°C)"),
        ("Temps", "Température"),
        ("Time", "Temperature"),
        ("Time (s)", "Temp (°C)"),
        ("Durée", "Temp. produit"),
        ("Horodatage", "T° produit"),
        ("temps_min", "temp_c"),
    ])
    def test_detection(self, entetes):
        assert main._detect_columns(_df(entetes))[:2] == entetes


class TestMesureSansMotCleDeTemperature:
    """L'enregistreur ne mesure qu'une grandeur : il ne la nomme pas toujours."""

    @pytest.mark.parametrize("mesure", [
        "Valeur", "Valeur mesurée", "Value", "Voie 1", "Voie 1 (°C)",
        "CH1", "Canal 1", "Mesure", "Relevé",
    ])
    def test_la_seconde_colonne_numerique_est_la_temperature(self, mesure):
        temps_col, temp_col, _ = main._detect_columns(_df(("Date / Heure", mesure)))
        assert temps_col == "Date / Heure"
        assert temp_col == mesure

    def test_les_valeurs_extraites_sont_les_bonnes(self):
        temps, temperatures, _ = main._extract_numeric_columns(_df(("Temps (min)", "Valeur")))[:3]
        assert temps == TEMPS
        assert temperatures == TEMPERATURES


class TestColonnesSurnumeraires:
    """Les exports portent souvent une unité, un index, un numéro de série."""

    def test_une_colonne_texte_intercalee_est_ignoree(self):
        df = _df(("Date / Heure", "Unité", "Valeur"),
                 [TEMPS, ["C"] * 5, TEMPERATURES])
        assert main._detect_columns(df)[:2] == ("Date / Heure", "Valeur")

    def test_un_index_numerique_en_tete_ne_prend_pas_la_place(self):
        df = _df(("N°", "Date / Heure", "Valeur"),
                 [[1, 2, 3, 4, 5], TEMPS, TEMPERATURES])
        assert main._detect_columns(df)[:2] == ("Date / Heure", "Valeur")


class TestAmbiguiteRefusee:
    """Deviner reste interdit là où le risque est réel."""

    def test_deux_colonnes_numeriques_sans_indication_de_temps(self):
        # Rien ne dit laquelle est le temps : refuser vaut mieux que tirer au
        # sort, une inversion donnant une VP fausse sans message.
        with pytest.raises(ValueError):
            main._detect_columns(_df(("Colonne A", "Colonne B")))

    def test_plusieurs_mesures_candidates(self):
        # Deux voies : c'est à l'utilisateur de dire laquelle suivre.
        df = _df(("Date / Heure", "Voie 1", "Voie 2"),
                 [TEMPS, TEMPERATURES, [19.0, 60.0, 68.0, 68.0, 55.0]])
        with pytest.raises(ValueError, match="[Pp]lusieurs"):
            main._detect_columns(df)

    def test_le_message_nomme_les_colonnes_du_fichier(self):
        with pytest.raises(ValueError) as e:
            main._detect_columns(_df(("Colonne A", "Colonne B")))
        assert "Colonne A" in str(e.value) and "Colonne B" in str(e.value)


class TestRepliPositionnel:
    """Un fichier sans en-tête exploitable garde le repli historique."""

    def test_deux_colonnes_anonymes_numerotees(self):
        df = _df(("col_0", "col_1"))
        assert main._detect_columns(df)[:2] == ("col_0", "col_1")


class TestDeductionAnnoncee:
    """Une colonne interprétée doit remonter jusqu'à l'écran.

    L'aide à l'import affirme que l'application indique quelle colonne elle a
    interprétée. La déduction n'allait d'abord que dans le journal serveur :
    l'aide promettait ce que le produit ne faisait pas.
    """

    def test_une_colonne_nommee_ne_produit_aucune_deduction(self):
        releve = main._extract_numeric_columns(_df(("Temps (min)", "Température (°C)")))
        assert releve.deduction is None

    def test_une_colonne_interpretee_est_annoncee(self):
        releve = main._extract_numeric_columns(_df(("Temps (min)", "Valeur")))
        assert releve.deduction is not None
        assert "Valeur" in releve.deduction

    def test_le_repli_positionnel_est_annonce(self):
        releve = main._extract_numeric_columns(_df(("col_0", "col_1")))
        assert releve.deduction is not None
        assert "en-tête" in releve.deduction

    def test_la_deduction_survit_a_une_colonne_horodatee(self):
        df = _df(("Date / Heure", "Valeur"),
                 [["09/09/2026 14:0%d:00" % i for i in range(5)], TEMPERATURES])
        releve = main._extract_numeric_columns(df)
        assert releve.unite_source == "minute"
        assert releve.deduction is not None and "Valeur" in releve.deduction
