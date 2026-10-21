package com.ifpc.api.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Help desk : une demande d'utilisateur devient une issue GitHub.
 *
 * <p>Le dépôt de destination est <b>public</b> par défaut : l'issue ne porte
 * donc jamais l'identité du demandeur. Elle porte une référence aléatoire,
 * que seul l'e-mail envoyé au service informatique relie à la personne
 * (cf. {@link EmailService#sendSupportTicketNotification}). Pour des demandes
 * qui doivent rester internes, {@code SUPPORT_GITHUB_REPO} peut désigner un
 * dépôt privé.</p>
 *
 * <p>Sans {@code SUPPORT_GITHUB_TOKEN}, le help desk est fermé et le dit
 * ({@link #actif()}) : le formulaire ne s'affiche pas, plutôt que d'accepter
 * une demande qui ne partirait nulle part.</p>
 */
@Slf4j
@Service
public class SupportService {

    /** Les trois portes du formulaire, et l'étiquette GitHub de chacune. */
    public enum Categorie {
        BUG("bug", "Problème"),
        QUESTION("question", "Question"),
        IDEE("enhancement", "Suggestion");

        final String etiquette;
        final String libelle;

        Categorie(String etiquette, String libelle) {
            this.etiquette = etiquette;
            this.libelle = libelle;
        }
    }

    /** Ce que l'utilisateur saisit, plus le contexte que l'écran ajoute seul. */
    public record Demande(Categorie categorie, String titre, String description, String page, String version) {
    }

    /** Ce qui revient à l'écran : le numéro à citer, et la référence interne. */
    public record Ticket(int numero, String url, String reference) {
    }

    static final int TITRE_MAX = 120;
    static final int DESCRIPTION_MAX = 5000;
    static final int DEMANDES_PAR_HEURE = 5;

    static final String ETIQUETTE_HELP_DESK = "help-desk";

    // « @quelqu'un » dans une issue notifie ce compte GitHub : un texte libre
    // venu de la plateforme ne doit pas pouvoir interpeller qui il veut.
    private static final Pattern MENTION = Pattern.compile("@(?=[A-Za-z0-9-])");

    @Value("${support.github.token:}")
    private String token;

    @Value("${support.github.repo:IFPC-APPS/PADOC}")
    private String depot;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    // Garde-fou contre l'envoi en rafale, par compte. En mémoire : un
    // redémarrage le remet à zéro, ce qui suffit pour un anti-spam.
    private final Map<String, Deque<Instant>> envoisRecents = new ConcurrentHashMap<>();

    @Autowired
    public SupportService(ObjectMapper objectMapper) {
        this(objectMapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    SupportService(ObjectMapper objectMapper, HttpClient httpClient) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public boolean actif() {
        return token != null && !token.isBlank() && depot != null && depot.contains("/");
    }

    /**
     * Crée l'issue et renvoie son numéro.
     *
     * @param compte clé du demandeur pour la limite d'envoi — jamais publiée
     */
    public Ticket creer(Demande demande, String compte) {
        if (!actif()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Le help desk n'est pas configuré.");
        }
        valider(demande);
        reserverEnvoi(compte);

        String reference = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> issue = new LinkedHashMap<>();
        issue.put("title", "[" + demande.categorie().libelle + "] " + neutraliser(demande.titre().strip()));
        issue.put("body", corps(demande, reference));
        issue.put("labels", List.of(ETIQUETTE_HELP_DESK, demande.categorie().etiquette));

        HttpResponse<String> reponse = envoyer(issue);
        // Étiquettes refusées (dépôt qui les a supprimées, jeton sans droit
        // d'écriture sur elles) : la demande compte plus que son classement.
        if (reponse.statusCode() == 422) {
            log.warn("Help desk : étiquettes refusées par GitHub, nouvel essai sans étiquette. {}", reponse.body());
            issue.remove("labels");
            reponse = envoyer(issue);
        }

        if (reponse.statusCode() != 201) {
            log.error("Help desk : GitHub a refusé l'issue [{}] : {}", reponse.statusCode(), reponse.body());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "La demande n'a pas pu être transmise.");
        }

        try {
            JsonNode cree = objectMapper.readTree(reponse.body());
            return new Ticket(cree.path("number").asInt(), cree.path("html_url").asText(), reference);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Réponse de GitHub illisible.", e);
        }
    }

    private void valider(Demande demande) {
        if (demande == null || demande.categorie() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez le type de demande.");
        }
        if (demande.titre() == null || demande.titre().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le titre est obligatoire.");
        }
        if (demande.titre().strip().length() > TITRE_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le titre ne doit pas dépasser " + TITRE_MAX + " caractères.");
        }
        if (demande.description() == null || demande.description().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Décrivez votre demande.");
        }
        if (demande.description().length() > DESCRIPTION_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La description ne doit pas dépasser " + DESCRIPTION_MAX + " caractères.");
        }
    }

    private void reserverEnvoi(String compte) {
        Instant maintenant = Instant.now();
        Instant ilYaUneHeure = maintenant.minus(Duration.ofHours(1));
        Deque<Instant> envois = envoisRecents.computeIfAbsent(compte.toLowerCase(), c -> new ArrayDeque<>());
        synchronized (envois) {
            while (!envois.isEmpty() && envois.peekFirst().isBefore(ilYaUneHeure)) {
                envois.pollFirst();
            }
            if (envois.size() >= DEMANDES_PAR_HEURE) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Trop de demandes envoyées : réessayez dans une heure.");
            }
            envois.addLast(maintenant);
        }
    }

    String corps(Demande demande, String reference) {
        StringBuilder corps = new StringBuilder();
        corps.append("**Type :** ").append(demande.categorie().libelle).append('\n');
        if (demande.page() != null && !demande.page().isBlank()) {
            corps.append("**Page :** `").append(demande.page().strip().replace("`", "")).append("`\n");
        }
        if (demande.version() != null && !demande.version().isBlank()) {
            corps.append("**Version :** ").append(neutraliser(demande.version().strip())).append('\n');
        }
        corps.append("\n---\n\n");
        corps.append(neutraliser(demande.description().strip())).append("\n\n---\n");
        corps.append("_Demande envoyée depuis le help desk de PADOC. Référence : `")
                .append(reference)
                .append("` — l'identité du demandeur est transmise au service informatique, pas ici._\n");
        return corps.toString();
    }

    static String neutraliser(String texte) {
        // Une espace sans chasse après « @ » : le texte reste lisible, la
        // mention ne part pas.
        return MENTION.matcher(texte).replaceAll("@​");
    }

    private HttpResponse<String> envoyer(Map<String, Object> issue) {
        try {
            HttpRequest requete = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.github.com/repos/" + depot.strip() + "/issues"))
                    .header("Authorization", "Bearer " + token.strip())
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(issue)))
                    .timeout(Duration.ofSeconds(15))
                    .build();
            return httpClient.send(requete, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "La demande n'a pas pu être transmise.", e);
        } catch (Exception e) {
            log.error("Help desk : GitHub injoignable", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "La demande n'a pas pu être transmise.", e);
        }
    }
}
