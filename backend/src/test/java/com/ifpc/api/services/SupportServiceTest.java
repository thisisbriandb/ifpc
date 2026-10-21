package com.ifpc.api.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ifpc.api.services.SupportService.Categorie;
import com.ifpc.api.services.SupportService.Demande;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Flow;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SupportServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpClient httpClient;
    private SupportService service;

    @BeforeEach
    void setUp() {
        httpClient = mock(HttpClient.class);
        service = new SupportService(objectMapper, httpClient);
        ReflectionTestUtils.setField(service, "token", "jeton-test");
        ReflectionTestUtils.setField(service, "depot", "IFPC-APPS/PADOC");
    }

    private static Demande demande() {
        return new Demande(Categorie.BUG, "Le graphique ne s'affiche pas",
                "Sur la page des cuves, rien ne s'affiche.", "/cuves", "0.2.0");
    }

    @SuppressWarnings("unchecked")
    private void githubRepond(int statut, String corps) throws Exception {
        HttpResponse<String> reponse = mock(HttpResponse.class);
        when(reponse.statusCode()).thenReturn(statut);
        when(reponse.body()).thenReturn(corps);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(reponse);
    }

    /** Relit le JSON réellement envoyé à GitHub. */
    private static JsonNode corpsEnvoye(HttpRequest requete) throws Exception {
        StringBuilder lu = new StringBuilder();
        requete.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<>() {
            public void onSubscribe(Flow.Subscription s) { s.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer b) { lu.append(StandardCharsets.UTF_8.decode(b)); }
            public void onError(Throwable t) { }
            public void onComplete() { }
        });
        return new ObjectMapper().readTree(lu.toString());
    }

    @Test
    @DisplayName("sans jeton, le help desk se déclare fermé et ne contacte pas GitHub")
    void fermeSansJeton() {
        ReflectionTestUtils.setField(service, "token", "");

        assertFalse(service.actif());
        ResponseStatusException refus = assertThrows(ResponseStatusException.class,
                () -> service.creer(demande(), "jean@ifpc.eu"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, refus.getStatusCode());
        verifyNoInteractions(httpClient);
    }

    @Test
    @DisplayName("crée l'issue avec titre, étiquettes et contexte, et renvoie son numéro")
    @SuppressWarnings("unchecked")
    void creeIssue() throws Exception {
        githubRepond(201, "{\"number\":42,\"html_url\":\"https://github.com/IFPC-APPS/PADOC/issues/42\"}");

        SupportService.Ticket ticket = service.creer(demande(), "jean@ifpc.eu");

        assertEquals(42, ticket.numero());
        assertEquals("https://github.com/IFPC-APPS/PADOC/issues/42", ticket.url());
        assertEquals(8, ticket.reference().length());

        ArgumentCaptor<HttpRequest> requete = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requete.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("https://api.github.com/repos/IFPC-APPS/PADOC/issues", requete.getValue().uri().toString());
        assertEquals("Bearer jeton-test", requete.getValue().headers().firstValue("Authorization").orElseThrow());

        JsonNode issue = corpsEnvoye(requete.getValue());
        assertEquals("[Problème] Le graphique ne s'affiche pas", issue.get("title").asText());
        assertEquals(List.of("help-desk", "bug"),
                List.of(issue.get("labels").get(0).asText(), issue.get("labels").get(1).asText()));
        String corps = issue.get("body").asText();
        assertTrue(corps.contains("`/cuves`"));
        assertTrue(corps.contains("0.2.0"));
        assertTrue(corps.contains(ticket.reference()));
    }

    @Test
    @DisplayName("l'issue, publique, ne porte jamais l'adresse du demandeur")
    @SuppressWarnings("unchecked")
    void anonyme() throws Exception {
        githubRepond(201, "{\"number\":1,\"html_url\":\"u\"}");

        service.creer(demande(), "jean.dupont@cidrerie.fr");

        ArgumentCaptor<HttpRequest> requete = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requete.capture(), any(HttpResponse.BodyHandler.class));
        assertFalse(corpsEnvoye(requete.getValue()).toString().contains("jean.dupont"));
    }

    @Test
    @DisplayName("une mention @compte dans le texte ne notifie personne sur GitHub")
    void mentionsNeutralisees() {
        assertEquals("merci @​thisisbriandb", SupportService.neutraliser("merci @thisisbriandb"));
        assertEquals("a@​b.fr", SupportService.neutraliser("a@b.fr"));
        assertEquals("prix @ 3 €", SupportService.neutraliser("prix @ 3 €"));
    }

    @Test
    @DisplayName("étiquettes refusées (422) : la demande repart sans elles")
    @SuppressWarnings("unchecked")
    void sansEtiquettesSiRefusees() throws Exception {
        HttpResponse<String> refus = mock(HttpResponse.class);
        when(refus.statusCode()).thenReturn(422);
        when(refus.body()).thenReturn("{}");
        HttpResponse<String> cree = mock(HttpResponse.class);
        when(cree.statusCode()).thenReturn(201);
        when(cree.body()).thenReturn("{\"number\":7,\"html_url\":\"u\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(refus, cree);

        assertEquals(7, service.creer(demande(), "jean@ifpc.eu").numero());

        ArgumentCaptor<HttpRequest> requetes = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient, times(2)).send(requetes.capture(), any(HttpResponse.BodyHandler.class));
        assertFalse(corpsEnvoye(requetes.getAllValues().get(1)).has("labels"));
    }

    @Test
    @DisplayName("GitHub refuse : 502, sans détail technique pour l'écran")
    void githubRefuse() throws Exception {
        githubRepond(401, "{\"message\":\"Bad credentials\"}");

        ResponseStatusException refus = assertThrows(ResponseStatusException.class,
                () -> service.creer(demande(), "jean@ifpc.eu"));
        assertEquals(HttpStatus.BAD_GATEWAY, refus.getStatusCode());
        assertFalse(refus.getReason().contains("credentials"));
    }

    @Test
    @DisplayName("titre ou description manquants, ou trop longs : 400 avant tout appel")
    void validation() {
        List<Demande> invalides = List.of(
                new Demande(null, "t", "d", null, null),
                new Demande(Categorie.QUESTION, " ", "d", null, null),
                new Demande(Categorie.QUESTION, "t", "", null, null),
                new Demande(Categorie.QUESTION, "x".repeat(SupportService.TITRE_MAX + 1), "d", null, null),
                new Demande(Categorie.QUESTION, "t", "x".repeat(SupportService.DESCRIPTION_MAX + 1), null, null));

        for (Demande d : invalides) {
            ResponseStatusException refus = assertThrows(ResponseStatusException.class,
                    () -> service.creer(d, "jean@ifpc.eu"));
            assertEquals(HttpStatus.BAD_REQUEST, refus.getStatusCode());
        }
        verifyNoInteractions(httpClient);
    }

    @Test
    @DisplayName("au-delà de cinq demandes par heure et par compte : 429")
    void limiteParCompte() throws Exception {
        githubRepond(201, "{\"number\":1,\"html_url\":\"u\"}");

        for (int i = 0; i < SupportService.DEMANDES_PAR_HEURE; i++) {
            service.creer(demande(), "jean@ifpc.eu");
        }
        ResponseStatusException refus = assertThrows(ResponseStatusException.class,
                () -> service.creer(demande(), "JEAN@ifpc.eu"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, refus.getStatusCode());

        // Un autre compte n'est pas pénalisé.
        assertDoesNotThrow(() -> service.creer(demande(), "marie@ifpc.eu"));
    }
}
