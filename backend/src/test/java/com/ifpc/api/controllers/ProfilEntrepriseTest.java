package com.ifpc.api.controllers;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Entreprise et fonction dans le profil.
 *
 * <p>Défaut remonté par l'utilisateur : « quand je mets à jour Entreprise et
 * Fonction, ça affiche enregistré mais les deux cases sont toujours vides ».</p>
 *
 * <p>Deux causes indépendantes, qui donnaient ensemble ce symptôme :</p>
 * <ul>
 *   <li><b>à l'écriture</b> — {@code ProfileUpdateRequest} ne déclarait que le
 *       prénom et le nom. Le client envoyait bien les deux autres champs, mais
 *       Jackson les écartait en silence (Spring Boot ignore les propriétés
 *       inconnues par défaut) et la réponse était 200 : « enregistré » ;</li>
 *   <li><b>à la lecture</b> — {@code UserDto} ne les portait pas davantage.
 *       Même écrits en base, ils ne seraient jamais revenus au formulaire, qui
 *       se remplit à partir de cette réponse.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class ProfilEntrepriseTest {

    @Mock private UserRepository userRepository;
    @Mock private AuthenticationService authenticationService;
    @Mock private PasswordEncoder passwordEncoder;

    private AuthController controller;
    private User utilisateur;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        utilisateur = User.builder()
                .id(1L).email("tech@ifpc.eu").firstName("Camille").lastName("Roux")
                .role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(utilisateur, null, utilisateur.getAuthorities()));
        controller = new AuthController(authenticationService, userRepository, passwordEncoder);
    }

    private AuthController.UserDto miseAJour(String entreprise, String fonction) {
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        ResponseEntity<?> reponse = controller.updateProfile(
                new AuthController.ProfileUpdateRequest("Camille", "Roux", entreprise, fonction));
        return (AuthController.UserDto) reponse.getBody();
    }

    // ── Écriture ────────────────────────────────────────────────────────

    @Test
    @DisplayName("l'entreprise et la fonction sont bien écrites en base")
    void lesDeuxChampsSontEcrits() {
        miseAJour("Cidrerie du Verger", "Responsable qualité");

        ArgumentCaptor<User> capture = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(capture.capture());
        assertEquals("Cidrerie du Verger", capture.getValue().getCompanyName());
        assertEquals("Responsable qualité", capture.getValue().getCompanyRole());
    }

    @Test
    @DisplayName("un champ omis ne devient pas vide")
    void unChampOmisNEstPasEcrase() {
        utilisateur.setCompanyName("Cidrerie du Verger");
        utilisateur.setCompanyRole("Responsable qualité");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        // Le client n'envoie que le nom : le reste doit survivre.
        controller.updateProfile(new AuthController.ProfileUpdateRequest(null, "Roux", null, null));

        assertEquals("Cidrerie du Verger", utilisateur.getCompanyName());
        assertEquals("Responsable qualité", utilisateur.getCompanyRole());
    }

    @Test
    @DisplayName("une chaîne vide efface bien la valeur")
    void uneChaineVideEfface() {
        utilisateur.setCompanyName("Cidrerie du Verger");
        miseAJour("", "");
        assertEquals("", utilisateur.getCompanyName());
    }

    // ── Lecture ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("la réponse d'enregistrement renvoie les deux champs")
    void laReponseDEnregistrementLesPorte() {
        AuthController.UserDto profil = miseAJour("Cidrerie du Verger", "Responsable qualité");

        assertEquals("Cidrerie du Verger", profil.companyName());
        assertEquals("Responsable qualité", profil.companyRole());
    }

    @Test
    @DisplayName("le profil relu porte les deux champs")
    void leProfilReluLesPorte() {
        utilisateur.setCompanyName("Cidrerie du Verger");
        utilisateur.setCompanyRole("Responsable qualité");

        AuthController.UserDto profil = controller.getMe().getBody();

        assertNotNull(profil);
        assertEquals("Cidrerie du Verger", profil.companyName());
        assertEquals("Responsable qualité", profil.companyRole());
    }

    // ── Le test qui aurait arrêté le défaut ─────────────────────────────

    @Test
    @DisplayName("enregistrer puis relire rend ce qui a été saisi")
    void enregistrerPuisRelire() {
        miseAJour("Cidrerie du Verger", "Responsable qualité");

        AuthController.UserDto relu = controller.getMe().getBody();

        assertNotNull(relu);
        assertEquals("Cidrerie du Verger", relu.companyName(),
                "le formulaire se remplit depuis cette réponse : vide ici, vide à l'écran");
        assertEquals("Responsable qualité", relu.companyRole());
    }
}
