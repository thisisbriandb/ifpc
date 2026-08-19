package com.ifpc.api.controllers;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock private AuthenticationService authenticationService;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks private AuthController authController;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("register delegates to AuthenticationService")
    void testRegister() {
        RegisterRequest req = RegisterRequest.builder().email("test@ifpc.eu").build();
        AuthenticationResponse expected = AuthenticationResponse.builder().message("OK").build();

        when(authenticationService.register(req)).thenReturn(expected);

        ResponseEntity<AuthenticationResponse> response = authController.register(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());
    }

    @Test
    @DisplayName("login delegates to AuthenticationService")
    void testLogin() {
        AuthenticationRequest req = AuthenticationRequest.builder().email("test@ifpc.eu").password("secret").build();
        AuthenticationResponse expected = AuthenticationResponse.builder().token("jwt").build();

        when(authenticationService.authenticate(req)).thenReturn(expected);

        ResponseEntity<AuthenticationResponse> response = authController.authenticate(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());
    }

    @Test
    @DisplayName("getMe returns 401 when not authenticated")
    void testGetMeUnauthenticated() {
        ResponseEntity<AuthController.UserDto> response = authController.getMe();
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("getMe returns user DTO when authenticated")
    void testGetMeAuthenticated() {
        User user = User.builder().firstName("Alice").lastName("Smith").email("alice@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
        );

        ResponseEntity<AuthController.UserDto> response = authController.getMe();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Alice", response.getBody().firstName());
        assertEquals("alice@ifpc.eu", response.getBody().email());
    }

    @Test
    @DisplayName("updateProfile updates user first and last name")
    void testUpdateProfile() {
        User user = User.builder().firstName("Bob").lastName("Old").email("bob@ifpc.eu").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
        );

        AuthController.ProfileUpdateRequest req = new AuthController.ProfileUpdateRequest("Robert", "New");
        ResponseEntity<?> response = authController.updateProfile(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Robert", user.getFirstName());
        assertEquals("New", user.getLastName());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("updateProfile returns 401 when unauthenticated")
    void testUpdateProfileUnauthenticated() {
        ResponseEntity<?> response = authController.updateProfile(new AuthController.ProfileUpdateRequest("A", "B"));
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("changePassword validates current password and updates with encoded new password")
    void testChangePasswordSuccess() {
        User user = User.builder().email("bob@ifpc.eu").password("encodedOld").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
        );

        when(passwordEncoder.matches("oldSecret", "encodedOld")).thenReturn(true);
        when(passwordEncoder.encode("newSecret123")).thenReturn("encodedNew");

        AuthController.PasswordChangeRequest req = new AuthController.PasswordChangeRequest("oldSecret", "newSecret123");
        ResponseEntity<?> response = authController.changePassword(req);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("encodedNew", user.getPassword());
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("changePassword fails if current password does not match")
    void testChangePasswordWrongCurrent() {
        User user = User.builder().email("bob@ifpc.eu").password("encodedOld").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
        );

        when(passwordEncoder.matches("wrongSecret", "encodedOld")).thenReturn(false);

        AuthController.PasswordChangeRequest req = new AuthController.PasswordChangeRequest("wrongSecret", "newSecret123");
        ResponseEntity<?> response = authController.changePassword(req);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("changePassword fails if new password is too short")
    void testChangePasswordTooShort() {
        User user = User.builder().email("bob@ifpc.eu").password("encodedOld").role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
        );

        when(passwordEncoder.matches("oldSecret", "encodedOld")).thenReturn(true);

        AuthController.PasswordChangeRequest req = new AuthController.PasswordChangeRequest("oldSecret", "123");
        ResponseEntity<?> response = authController.changePassword(req);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("changePassword returns 401 when unauthenticated")
    void testChangePasswordUnauthenticated() {
        ResponseEntity<?> response = authController.changePassword(new AuthController.PasswordChangeRequest("a", "b"));
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("forgotPassword parses headers and calls service")
    void testForgotPassword() {
        AuthController.ForgotPasswordRequest req = new AuthController.ForgotPasswordRequest("test@ifpc.eu");
        AuthenticationService.MessageResponse expected = new AuthenticationService.MessageResponse("Email sent");

        when(authenticationService.forgotPassword("test@ifpc.eu", "https://ifpc.eu")).thenReturn(expected);

        ResponseEntity<?> response = authController.forgotPassword(req, "https://ifpc.eu", null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());
    }

    @Test
    @DisplayName("forgotPassword parses referer header if origin is blank")
    void testForgotPasswordWithReferer() {
        AuthController.ForgotPasswordRequest req = new AuthController.ForgotPasswordRequest("test@ifpc.eu");
        AuthenticationService.MessageResponse expected = new AuthenticationService.MessageResponse("Email sent");

        when(authenticationService.forgotPassword("test@ifpc.eu", "http://localhost:3000")).thenReturn(expected);

        ResponseEntity<?> response = authController.forgotPassword(req, "", "http://localhost:3000/reset-password");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());
    }

    @Test
    @DisplayName("forgotPassword when origin and referer are null or empty")
    void testForgotPasswordNoOriginOrReferer() {
        AuthController.ForgotPasswordRequest req = new AuthController.ForgotPasswordRequest("test@ifpc.eu");
        AuthenticationService.MessageResponse expected = new AuthenticationService.MessageResponse("Email sent");

        when(authenticationService.forgotPassword("test@ifpc.eu", null)).thenReturn(expected);

        ResponseEntity<?> response = authController.forgotPassword(req, null, "   ");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());
    }

    @Test
    @DisplayName("verifyResetToken returns 200 for valid token and 400 for invalid token")
    void testVerifyResetToken() {
        when(authenticationService.verifyResetToken("validToken")).thenReturn(true);
        when(authenticationService.verifyResetToken("invalidToken")).thenReturn(false);

        ResponseEntity<?> validResp = authController.verifyResetToken("validToken");
        assertEquals(HttpStatus.OK, validResp.getStatusCode());

        ResponseEntity<?> invalidResp = authController.verifyResetToken("invalidToken");
        assertEquals(HttpStatus.BAD_REQUEST, invalidResp.getStatusCode());
    }

    @Test
    @DisplayName("resetPassword returns 200 on success and 400 on service exception")
    void testResetPassword() {
        AuthController.ResetPasswordApiRequest req = new AuthController.ResetPasswordApiRequest("token123", "newPassword123");
        AuthenticationService.MessageResponse expected = new AuthenticationService.MessageResponse("Reset ok");

        when(authenticationService.resetPassword("token123", "newPassword123")).thenReturn(expected);

        ResponseEntity<?> response = authController.resetPassword(req);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expected, response.getBody());

        when(authenticationService.resetPassword("badToken", "newPassword123")).thenThrow(new RuntimeException("Token expired"));
        ResponseEntity<?> badResp = authController.resetPassword(new AuthController.ResetPasswordApiRequest("badToken", "newPassword123"));
        assertEquals(HttpStatus.BAD_REQUEST, badResp.getStatusCode());
    }
}
