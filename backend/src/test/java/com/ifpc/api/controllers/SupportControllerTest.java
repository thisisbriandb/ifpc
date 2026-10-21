package com.ifpc.api.controllers;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.services.EmailService;
import com.ifpc.api.services.SupportService;
import com.ifpc.api.services.SupportService.Categorie;
import com.ifpc.api.services.SupportService.Demande;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportControllerTest {

    @Mock private SupportService supportService;
    @Mock private EmailService emailService;

    @InjectMocks private SupportController controller;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static User connecter() {
        User user = User.builder().firstName("Jean").lastName("Dupont")
                .email("jean@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));
        return user;
    }

    @Test
    @DisplayName("le statut dit si le help desk peut recevoir une demande")
    void statut() {
        when(supportService.actif()).thenReturn(true);
        assertEquals(true, controller.statut().get("actif"));
    }

    @Test
    @DisplayName("une demande crée l'issue et prévient le service informatique de qui l'envoie")
    void creer() {
        User user = connecter();
        Demande demande = new Demande(Categorie.QUESTION, "  Export Excel ?  ", "Comment exporter ?", "/lots", "0.2.0");
        when(supportService.creer(demande, "jean@ifpc.eu"))
                .thenReturn(new SupportService.Ticket(12, "https://github.com/x/y/issues/12", "abcd1234"));

        var reponse = controller.creer(demande);

        assertEquals(HttpStatus.CREATED, reponse.getStatusCode());
        assertEquals(12, reponse.getBody().get("numero"));
        verify(emailService).sendSupportTicketNotification(user, 12,
                "https://github.com/x/y/issues/12", "Export Excel ?", "abcd1234");
    }

    @Test
    @DisplayName("sans compte connecté : 401, rien n'est créé")
    void anonymeRefuse() {
        Demande demande = new Demande(Categorie.BUG, "t", "d", null, null);

        ResponseStatusException refus = assertThrows(ResponseStatusException.class, () -> controller.creer(demande));
        assertEquals(HttpStatus.UNAUTHORIZED, refus.getStatusCode());
        verify(supportService, never()).creer(any(), anyString());
        verifyNoInteractions(emailService);
    }
}
