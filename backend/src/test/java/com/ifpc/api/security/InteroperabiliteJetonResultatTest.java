package com.ifpc.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Un sceau produit par le moteur de calcul est relu par le Core API.
 *
 * <p>Les deux services signent avec la même clé mais deux bibliothèques
 * différentes : PyJWT côté Python, jjwt côté Java. Une incompatibilité entre
 * elles ne se verrait qu'en production, sous la forme d'un 403 à l'archivage
 * d'une analyse — le Core API refusant un jeton pourtant légitime.</p>
 *
 * <p>Le jeton ci-dessous a été réellement produit par
 * {@code auth.signer_resultat()} avec le secret de test, et figé ici. Le
 * regénérer si la structure du sceau change :</p>
 *
 * <pre>
 * JWT_SECRET=&lt;SECRET_TEST&gt; python -c "import auth; print(auth.signer_resultat(...))"
 * </pre>
 */
class InteroperabiliteJetonResultatTest {

    /** Base64 de « temoin-de-test-partage-entre-le-moteur-et-le-core-api ». */
    private static final String SECRET_TEST =
            "dGVtb2luLWRlLXRlc3QtcGFydGFnZS1lbnRyZS1sZS1tb3RldXItZXQtbGUtY29yZS1hcGk=";

    /** Sceau émis par PyJWT, expiration lointaine pour que le test ne périme pas. */
    private static final String JETON_DU_MOTEUR =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            + "eyJ0eXBfcmVzdWx0YXQiOiJjb250cm9sZSIsInN0YXR1dCI6Imluc3VmZmlzYW50IiwidnAiOjMxLjAs"
            + "InZwX2NpYmxlIjo0MTcuMCwia19jYWxjIjoxLjEsInBhcmFtZXRyZXMiOnsibWljcm9vcmdhbmlzbWVf"
            + "a2V5IjoiYWxpY3ljbG9fc3RkIiwidF9yZWYiOjk1LjB9LCJqdGkiOiI0ZWQxMzc4MTMwMzc0NDNlOTI1"
            + "ZTRmZWE1MDJiMDU1MCIsImlhdCI6MTc4ODQyNjU0MCwiZXhwIjo0OTQyMDI2NTQwfQ."
            + "B1HHyIbuzFB--yL9DE_4hV8iL6Hlykb4mm57pkUcEfY";

    private JwtService serviceAvecSecret(String secretBase64) {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secretKey", secretBase64);
        return service;
    }

    @Test
    @DisplayName("jjwt relit un jeton signé par PyJWT avec le même secret")
    void unJetonPythonEstRelisibleEnJava() {
        Claims claims = serviceAvecSecret(SECRET_TEST).lireClaims(JETON_DU_MOTEUR);

        assertEquals("controle", claims.get("typ_resultat", String.class));
        assertEquals("insuffisant", claims.get("statut", String.class));
        assertEquals(31.0, ((Number) claims.get("vp")).doubleValue());
        assertEquals(417.0, ((Number) claims.get("vp_cible")).doubleValue());
        assertEquals(1.1, ((Number) claims.get("k_calc")).doubleValue());
    }

    @Test
    @DisplayName("le jti et l'expiration traversent la frontière")
    void leJtiEtLExpirationTraversent() {
        Claims claims = serviceAvecSecret(SECRET_TEST).lireClaims(JETON_DU_MOTEUR);

        // Le jti est ce qui interdit de rejouer un résultat sur un autre lot.
        assertEquals("4ed13781303744 3e925e4fea502b0550".replace(" ", ""), claims.getId());
        assertNotNull(claims.getExpiration());
    }

    @Test
    @DisplayName("les paramètres imbriqués traversent la frontière")
    void lesParametresTraversent() {
        Object parametres = serviceAvecSecret(SECRET_TEST).lireClaims(JETON_DU_MOTEUR).get("parametres");

        assertInstanceOf(Map.class, parametres);
        assertEquals("alicyclo_std", ((Map<?, ?>) parametres).get("microorganisme_key"));
        assertEquals(95.0, ((Number) ((Map<?, ?>) parametres).get("t_ref")).doubleValue());
    }

    @Test
    @DisplayName("un secret différent fait échouer la vérification")
    void unSecretDifferentEchoue() {
        // C'est la cause la plus probable d'un 403 à l'archivage en
        // exploitation : les deux services doivent porter exactement la même
        // valeur de JWT_SECRET.
        String autreSecret = "YXV0cmUtY2xlLXF1aS1uZS1jb3JyZXNwb25kLXBhcy1kdS10b3V0LWljaS1tZW1l";
        assertThrows(JwtException.class,
                () -> serviceAvecSecret(autreSecret).lireClaims(JETON_DU_MOTEUR));
    }
}
