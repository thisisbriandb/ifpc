package com.ifpc.api.controllers;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
import com.ifpc.api.security.JwtService;
import com.ifpc.api.services.EmailService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AuthenticationService}.
 * Covers register, authenticate, forgot-password, verify/reset token flows.
 */
@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private EmailService emailService;

    @InjectMocks private AuthenticationService authService;

    // ── REGISTER ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("register")
    class Register {

        @Test
        @DisplayName("should create PENDING user and send notification email")
        void successfulRegistration() {
            RegisterRequest request = RegisterRequest.builder()
                    .firstName("Jean")
                    .lastName("Dupont")
                    .companyName("Cidrerie Test")
                    .companyRole("Qualité")
                    .email("jean@test.com")
                    .password("password123")
                    .build();

            when(passwordEncoder.encode("password123")).thenReturn("encoded-pwd");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            AuthenticationResponse response = authService.register(request);

            assertNull(response.getToken());
            assertTrue(response.isPending());
            assertNotNull(response.getMessage());
            verify(emailService).sendNewRegistrationNotification(any(User.class));
            verify(userRepository).save(argThat(user ->
                    user.getRole() == Role.PENDING && !user.isEnabled()
            ));
        }
    }

    // ── AUTHENTICATE ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("authenticate")
    class Authenticate {

        @Test
        @DisplayName("should return pending response for PENDING user")
        void pendingUser() {
            User pendingUser = User.builder()
                    .email("pending@test.com")
                    .password("encoded")
                    .role(Role.PENDING)
                    .enabled(false)
                    .build();

            AuthenticationRequest request = AuthenticationRequest.builder()
                    .email("pending@test.com")
                    .password("password")
                    .build();

            when(userRepository.findByEmail("pending@test.com")).thenReturn(Optional.of(pendingUser));

            AuthenticationResponse response = authService.authenticate(request);

            assertTrue(response.isPending());
            assertNull(response.getToken());
            verify(authenticationManager, never()).authenticate(any());
        }

        @Test
        @DisplayName("should return JWT token for active user")
        void activeUser() {
            User activeUser = User.builder()
                    .email("active@test.com")
                    .password("encoded")
                    .role(Role.USER)
                    .enabled(true)
                    .build();

            AuthenticationRequest request = AuthenticationRequest.builder()
                    .email("active@test.com")
                    .password("password123")
                    .build();

            when(userRepository.findByEmail("active@test.com")).thenReturn(Optional.of(activeUser));
            when(jwtService.generateToken(activeUser)).thenReturn("jwt-token-xyz");

            AuthenticationResponse response = authService.authenticate(request);

            assertFalse(response.isPending());
            assertEquals("jwt-token-xyz", response.getToken());
            assertNotNull(activeUser.getLastLogin());
            verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
            verify(userRepository).save(activeUser);
        }

        @Test
        @DisplayName("should throw when user not found")
        void userNotFound() {
            AuthenticationRequest request = AuthenticationRequest.builder()
                    .email("ghost@test.com")
                    .password("password")
                    .build();

            when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

            assertThrows(RuntimeException.class, () -> authService.authenticate(request));
        }

        @Test
        @DisplayName("should return pending for disabled user even with non-PENDING role")
        void disabledUser() {
            User disabledUser = User.builder()
                    .email("disabled@test.com")
                    .password("encoded")
                    .role(Role.USER)
                    .enabled(false)
                    .build();

            AuthenticationRequest request = AuthenticationRequest.builder()
                    .email("disabled@test.com")
                    .password("password")
                    .build();

            when(userRepository.findByEmail("disabled@test.com")).thenReturn(Optional.of(disabledUser));

            AuthenticationResponse response = authService.authenticate(request);
            assertTrue(response.isPending());
        }
    }

    // ── FORGOT PASSWORD ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("forgotPassword")
    class ForgotPassword {

        @Test
        @DisplayName("should send reset email for existing user")
        void existingUser() {
            User user = User.builder()
                    .email("user@test.com")
                    .firstName("Test")
                    .role(Role.USER)
                    .enabled(true)
                    .build();

            when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));

            AuthenticationService.MessageResponse response = authService.forgotPassword("user@test.com", "https://ifpc.eu");

            assertNotNull(response.message());
            assertNotNull(user.getResetPasswordToken());
            assertNotNull(user.getResetPasswordTokenExpiry());
            verify(emailService).sendPasswordResetNotification(eq(user), anyString(), eq("https://ifpc.eu"));
        }

        @Test
        @DisplayName("should return generic message for non-existing user (no info leak)")
        void nonExistingUser() {
            when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

            AuthenticationService.MessageResponse response = authService.forgotPassword("ghost@test.com", "https://ifpc.eu");

            assertNotNull(response.message());
            verify(emailService, never()).sendPasswordResetNotification(any(), anyString(), anyString());
        }

        @Test
        @DisplayName("should handle null email gracefully")
        void nullEmail() {
            AuthenticationService.MessageResponse response = authService.forgotPassword(null, "https://ifpc.eu");
            assertNotNull(response.message());
        }

        @Test
        @DisplayName("should handle blank email gracefully")
        void blankEmail() {
            AuthenticationService.MessageResponse response = authService.forgotPassword("   ", "https://ifpc.eu");
            assertNotNull(response.message());
        }
    }

    // ── VERIFY RESET TOKEN ──────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyResetToken")
    class VerifyResetToken {

        @Test
        @DisplayName("should return true for valid non-expired token")
        void validToken() {
            User user = User.builder()
                    .email("user@test.com")
                    .resetPasswordToken("valid-token")
                    .resetPasswordTokenExpiry(LocalDateTime.now().plusHours(1))
                    .role(Role.USER)
                    .build();

            when(userRepository.findByResetPasswordToken("valid-token")).thenReturn(Optional.of(user));

            assertTrue(authService.verifyResetToken("valid-token"));
        }

        @Test
        @DisplayName("should return false for expired token")
        void expiredToken() {
            User user = User.builder()
                    .email("user@test.com")
                    .resetPasswordToken("expired-token")
                    .resetPasswordTokenExpiry(LocalDateTime.now().minusHours(1))
                    .role(Role.USER)
                    .build();

            when(userRepository.findByResetPasswordToken("expired-token")).thenReturn(Optional.of(user));

            assertFalse(authService.verifyResetToken("expired-token"));
        }

        @Test
        @DisplayName("should return false for unknown token")
        void unknownToken() {
            when(userRepository.findByResetPasswordToken("unknown")).thenReturn(Optional.empty());
            assertFalse(authService.verifyResetToken("unknown"));
        }

        @Test
        @DisplayName("should return false for null token")
        void nullToken() {
            assertFalse(authService.verifyResetToken(null));
        }

        @Test
        @DisplayName("should return false for blank token")
        void blankToken() {
            assertFalse(authService.verifyResetToken("  "));
        }
    }

    // ── RESET PASSWORD ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("resetPassword")
    class ResetPassword {

        @Test
        @DisplayName("should reset password and clear token")
        void successfulReset() {
            User user = User.builder()
                    .email("user@test.com")
                    .resetPasswordToken("valid-token")
                    .resetPasswordTokenExpiry(LocalDateTime.now().plusHours(1))
                    .role(Role.USER)
                    .build();

            when(userRepository.findByResetPasswordToken("valid-token")).thenReturn(Optional.of(user));
            when(passwordEncoder.encode("newPassword123")).thenReturn("encoded-new-pwd");

            AuthenticationService.MessageResponse response = authService.resetPassword("valid-token", "newPassword123");

            assertNotNull(response.message());
            assertEquals("encoded-new-pwd", user.getPassword());
            assertNull(user.getResetPasswordToken());
            assertNull(user.getResetPasswordTokenExpiry());
            verify(userRepository).save(user);
        }

        @Test
        @DisplayName("should throw for expired token")
        void expiredToken() {
            User user = User.builder()
                    .email("user@test.com")
                    .resetPasswordToken("expired-token")
                    .resetPasswordTokenExpiry(LocalDateTime.now().minusHours(1))
                    .role(Role.USER)
                    .build();

            when(userRepository.findByResetPasswordToken("expired-token")).thenReturn(Optional.of(user));

            assertThrows(RuntimeException.class, () -> authService.resetPassword("expired-token", "newPwd123"));
        }

        @Test
        @DisplayName("should throw for null token")
        void nullToken() {
            assertThrows(RuntimeException.class, () -> authService.resetPassword(null, "newPwd123"));
        }

        @Test
        @DisplayName("should throw for unknown token")
        void unknownToken() {
            when(userRepository.findByResetPasswordToken("unknown")).thenReturn(Optional.empty());
            assertThrows(RuntimeException.class, () -> authService.resetPassword("unknown", "newPwd123"));
        }

        @Test
        @DisplayName("should throw for too short password")
        void shortPassword() {
            User user = User.builder()
                    .email("user@test.com")
                    .resetPasswordToken("valid-token")
                    .resetPasswordTokenExpiry(LocalDateTime.now().plusHours(1))
                    .role(Role.USER)
                    .build();

            when(userRepository.findByResetPasswordToken("valid-token")).thenReturn(Optional.of(user));

            assertThrows(RuntimeException.class, () -> authService.resetPassword("valid-token", "abc"));
        }

        @Test
        @DisplayName("should throw for null password")
        void nullPassword() {
            User user = User.builder()
                    .email("user@test.com")
                    .resetPasswordToken("valid-token")
                    .resetPasswordTokenExpiry(LocalDateTime.now().plusHours(1))
                    .role(Role.USER)
                    .build();

            when(userRepository.findByResetPasswordToken("valid-token")).thenReturn(Optional.of(user));

            assertThrows(RuntimeException.class, () -> authService.resetPassword("valid-token", null));
        }
    }
}
