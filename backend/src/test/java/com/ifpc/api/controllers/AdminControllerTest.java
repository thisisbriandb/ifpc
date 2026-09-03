package com.ifpc.api.controllers;

import com.ifpc.api.models.HelpText;
import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.AuditLogRepository;
import com.ifpc.api.repositories.HelpTextRepository;
import com.ifpc.api.repositories.UserRepository;
import com.ifpc.api.services.AuditService;
import com.ifpc.api.services.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock private UserRepository userRepository;
    @Mock private HelpTextRepository helpTextRepository;
    @Mock private EmailService emailService;
    @Mock private AuditService auditService;
    @Mock private AuditLogRepository auditLogRepository;

    @InjectMocks private AdminController adminController;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("getAllUsers returns list of user DTOs")
    void testGetAllUsers() {
        User u1 = User.builder().id(1L).email("u1@ifpc.eu").role(Role.USER).enabled(true).build();
        User u2 = User.builder().id(2L).email("u2@ifpc.eu").role(Role.ADMIN).enabled(true).build();
        when(userRepository.findAll()).thenReturn(List.of(u1, u2));

        ResponseEntity<List<AdminController.UserDto>> response = adminController.getAllUsers();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(2, response.getBody().size());
    }

    @Test
    @DisplayName("getPendingUsers returns only users with PENDING role")
    void testGetPendingUsers() {
        User u1 = User.builder().id(1L).email("u1@ifpc.eu").role(Role.PENDING).enabled(false).build();
        User u2 = User.builder().id(2L).email("u2@ifpc.eu").role(Role.USER).enabled(true).build();
        when(userRepository.findAll()).thenReturn(List.of(u1, u2));

        ResponseEntity<List<AdminController.UserDto>> response = adminController.getPendingUsers();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
        assertEquals("u1@ifpc.eu", response.getBody().get(0).email());
    }

    @Test
    @DisplayName("updateUserRole from PENDING sends email notification")
    void testUpdateUserRoleFromPending() {
        User user = User.builder().id(1L).email("user@ifpc.eu").role(Role.PENDING).enabled(false).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        ResponseEntity<String> response = adminController.updateUserRole(1L, new AdminController.RoleUpdateRequest("EXPERT"));
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(Role.EXPERT, user.getRole());
        assertTrue(user.isEnabled());
        verify(userRepository).save(user);
        verify(emailService).sendAccountApprovedNotification(user);
    }

    @Test
    @DisplayName("updateUserRole from USER does not trigger welcome email")
    void testUpdateUserRoleFromUser() {
        User user = User.builder().id(1L).email("user@ifpc.eu").role(Role.USER).enabled(true).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        ResponseEntity<String> response = adminController.updateUserRole(1L, new AdminController.RoleUpdateRequest("ADMIN"));
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(Role.ADMIN, user.getRole());
        verify(emailService, never()).sendAccountApprovedNotification(any());
    }

    @Test
    @DisplayName("updateUserRole, approveUser, rejectUser, deleteUser throw RuntimeException for non-existent users")
    void testUserManagementNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> adminController.updateUserRole(99L, new AdminController.RoleUpdateRequest("USER")));
        assertThrows(RuntimeException.class, () -> adminController.approveUser(99L));
        assertThrows(RuntimeException.class, () -> adminController.rejectUser(99L));
        assertThrows(RuntimeException.class, () -> adminController.deleteUser(99L, null));
    }

    @Test
    @DisplayName("updateUserRole returns 400 for invalid role string")
    void testUpdateUserRoleInvalid() {
        User user = User.builder().id(1L).email("user@ifpc.eu").role(Role.USER).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        ResponseEntity<String> response = adminController.updateUserRole(1L, new AdminController.RoleUpdateRequest("SUPER_GOD"));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("approveUser updates role to USER and enables user")
    void testApproveUser() {
        User user = User.builder().id(1L).email("user@ifpc.eu").role(Role.PENDING).enabled(false).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        ResponseEntity<String> response = adminController.approveUser(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(Role.USER, user.getRole());
        assertTrue(user.isEnabled());
        verify(emailService).sendAccountApprovedNotification(user);
    }

    @Test
    @DisplayName("rejectUser deletes user")
    void testRejectUser() {
        User user = User.builder().id(1L).email("user@ifpc.eu").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        ResponseEntity<String> response = adminController.rejectUser(1L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(userRepository).delete(user);
    }

    @Test
    @DisplayName("deleteUser prevents admin from deleting self")
    void testDeleteUserSelfPrevention() {
        User admin = User.builder().id(1L).email("admin@ifpc.eu").role(Role.ADMIN).build();
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities());

        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        ResponseEntity<String> response = adminController.deleteUser(1L, auth);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteUser deletes user when not deleting self")
    void testDeleteUserSuccess() {
        User admin = User.builder().id(1L).email("admin@ifpc.eu").role(Role.ADMIN).build();
        User target = User.builder().id(2L).email("other@ifpc.eu").role(Role.USER).build();
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities());

        when(userRepository.findById(2L)).thenReturn(Optional.of(target));

        ResponseEntity<String> response = adminController.deleteUser(2L, auth);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(userRepository).delete(target);
    }


    @Test
    @DisplayName("getHelpText returns fallback or unlocalized help text")
    void testGetHelpTextFallback() {
        HelpText htDefault = HelpText.builder().textKey("pasto").content("Default Pasto Text").build();
        when(helpTextRepository.findByTextKey("pasto__fr")).thenReturn(Optional.empty());
        when(helpTextRepository.findByTextKey("pasto")).thenReturn(Optional.of(htDefault));

        ResponseEntity<AdminController.HelpTextDto> response = adminController.getHelpText("pasto", "fr");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Default Pasto Text", response.getBody().content());

        // Without language parameter
        when(helpTextRepository.findByTextKey("pasto")).thenReturn(Optional.of(htDefault));
        ResponseEntity<AdminController.HelpTextDto> noLangResp = adminController.getHelpText("pasto", null);
        assertEquals(HttpStatus.OK, noLangResp.getStatusCode());
        assertEquals("Default Pasto Text", noLangResp.getBody().content());
    }

    @Test
    @DisplayName("updateHelpText updates existing entry if key exists")
    void testUpdateHelpTextExisting() {
        HelpText htExisting = HelpText.builder().textKey("pasto__fr").content("Old Content").build();
        when(helpTextRepository.findByTextKey("pasto__fr")).thenReturn(Optional.of(htExisting));

        ResponseEntity<AdminController.HelpTextDto> response = adminController.updateHelpText("pasto", new AdminController.HelpTextUpdateRequest("Updated Content", "fr"));
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Updated Content", htExisting.getContent());
        verify(helpTextRepository).save(htExisting);
    }
}
