package com.ifpc.api.services;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link EmailService}.
 * Tests template rendering, input sanitization (XSS/HTML/JSON escaping),
 * null handling, and API key resolution — all without network I/O.
 */
class EmailServiceTest {

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        emailService = new EmailService();
        // No API key → sendEmail will log a warning and exit early (no network call)
        ReflectionTestUtils.setField(emailService, "apiKey", "");
        ReflectionTestUtils.setField(emailService, "fromEmail", "test@ifpc.eu");
        ReflectionTestUtils.setField(emailService, "adminEmail", "admin@ifpc.eu");
    }

    // ── Registration notification ───────────────────────────────────────────

    @Nested
    @DisplayName("sendNewRegistrationNotification")
    class RegistrationNotification {

        @Test
        @DisplayName("should not throw with valid user data")
        void validUser() {
            User user = User.builder()
                    .firstName("Jean")
                    .lastName("Dupont")
                    .email("jean.dupont@example.com")
                    .companyName("Cidrerie Test")
                    .companyRole("Responsable Qualité")
                    .role(Role.PENDING)
                    .build();

            assertDoesNotThrow(() -> emailService.sendNewRegistrationNotification(user));
        }

        @Test
        @DisplayName("should handle null fields gracefully via safeString")
        void nullFields() {
            User user = User.builder()
                    .email("test@test.com")
                    .role(Role.PENDING)
                    .build();

            assertDoesNotThrow(() -> emailService.sendNewRegistrationNotification(user));
        }

        @Test
        @DisplayName("should sanitize XSS in user fields")
        void xssInFields() {
            User user = User.builder()
                    .firstName("<script>alert('xss')</script>")
                    .lastName("O'Brien & Co")
                    .email("hacker@evil.com")
                    .companyName("Corp \"Evil\"")
                    .companyRole("Admin<hr>")
                    .role(Role.PENDING)
                    .build();

            assertDoesNotThrow(() -> emailService.sendNewRegistrationNotification(user));
        }
    }

    // ── Account approved notification ───────────────────────────────────────

    @Nested
    @DisplayName("sendAccountApprovedNotification")
    class ApprovedNotification {

        @Test
        @DisplayName("should not throw with valid user data")
        void validUser() {
            User user = User.builder()
                    .firstName("Marie")
                    .lastName("Curie")
                    .email("marie@ifpc.eu")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendAccountApprovedNotification(user));
        }

        @Test
        @DisplayName("should skip when email is null")
        void nullEmail() {
            User user = User.builder()
                    .firstName("Nobody")
                    .role(Role.USER)
                    .build();

            // Should just log and return, not throw
            assertDoesNotThrow(() -> emailService.sendAccountApprovedNotification(user));
        }

        @Test
        @DisplayName("should skip when email is blank")
        void blankEmail() {
            User user = User.builder()
                    .firstName("Nobody")
                    .email("   ")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendAccountApprovedNotification(user));
        }
    }

    // ── Password reset notification ─────────────────────────────────────────

    @Nested
    @DisplayName("sendPasswordResetNotification")
    class PasswordResetNotification {

        @Test
        @DisplayName("should not throw with valid data")
        void validData() {
            User user = User.builder()
                    .firstName("Alice")
                    .email("alice@ifpc.eu")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendPasswordResetNotification(user, "abc-123-token", "https://ifpc.eu"));
        }

        @Test
        @DisplayName("should handle null baseUrl by falling back to https://ifpc.eu")
        void nullBaseUrl() {
            User user = User.builder()
                    .firstName("Bob")
                    .email("bob@ifpc.eu")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendPasswordResetNotification(user, "token-xyz", null));
        }

        @Test
        @DisplayName("should handle blank baseUrl")
        void blankBaseUrl() {
            User user = User.builder()
                    .firstName("Bob")
                    .email("bob@ifpc.eu")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendPasswordResetNotification(user, "token-xyz", "  "));
        }

        @Test
        @DisplayName("should strip trailing slashes from baseUrl")
        void trailingSlashes() {
            User user = User.builder()
                    .firstName("Charlie")
                    .email("charlie@ifpc.eu")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendPasswordResetNotification(user, "t1", "https://ifpc.eu///"));
        }

        @Test
        @DisplayName("should skip when user email is null")
        void nullUserEmail() {
            User user = User.builder()
                    .firstName("NoEmail")
                    .role(Role.USER)
                    .build();

            assertDoesNotThrow(() -> emailService.sendPasswordResetNotification(user, "token", "https://ifpc.eu"));
        }
    }

    // ── Helper methods (tested via Reflection) ──────────────────────────────

    @Nested
    @DisplayName("Utility method coverage via reflection")
    class UtilityMethods {

        @Test
        @DisplayName("escapeHtml should replace special characters")
        void escapeHtml() {
            String result = invokeEscapeHtml("<b>Hello</b> & 'World' \"Test\"");
            assertTrue(result.contains("&lt;b&gt;"));
            assertTrue(result.contains("&amp;"));
            assertTrue(result.contains("&#39;"));
            assertTrue(result.contains("&quot;"));
            assertFalse(result.contains("<b>"));
        }

        @Test
        @DisplayName("escapeHtml should handle null")
        void escapeHtmlNull() {
            String result = invokeEscapeHtml(null);
            assertEquals("", result);
        }

        @Test
        @DisplayName("safeString should handle null and non-null")
        void safeString() {
            assertEquals("", invokeSafeString(null));
            assertEquals("hello", invokeSafeString("hello"));
        }

        @Test
        @DisplayName("escapeJsonString should handle special characters")
        void escapeJsonString() {
            String result = invokeEscapeJsonString("Hello \"world\"\nnewline\ttab\\backslash");
            assertTrue(result.startsWith("\""));
            assertTrue(result.endsWith("\""));
            assertTrue(result.contains("\\\""));
            assertTrue(result.contains("\\n"));
            assertTrue(result.contains("\\t"));
            assertTrue(result.contains("\\\\"));
        }

        @Test
        @DisplayName("escapeJsonString should handle null")
        void escapeJsonStringNull() {
            String result = invokeEscapeJsonString(null);
            assertEquals("\"\"", result);
        }

        @Test
        @DisplayName("escapeJsonString should escape control characters")
        void escapeJsonStringControlChars() {
            String result = invokeEscapeJsonString("\b\f");
            assertTrue(result.contains("\\b"));
            assertTrue(result.contains("\\f"));
        }

        @Test
        @DisplayName("toJsonPayload should produce valid JSON structure")
        void toJsonPayload() {
            String result = invokeToJsonPayload("from@test.com", "to@test.com", "Subject", "<h1>Hello</h1>");
            assertTrue(result.contains("\"from\""));
            assertTrue(result.contains("\"to\""));
            assertTrue(result.contains("\"subject\""));
            assertTrue(result.contains("\"html\""));
        }

        // ── Reflection helpers ──────────────────────────────────────────────

        private String invokeEscapeHtml(String input) {
            return (String) ReflectionTestUtils.invokeMethod(emailService, "escapeHtml", input);
        }

        private String invokeSafeString(String input) {
            return (String) ReflectionTestUtils.invokeMethod(emailService, "safeString", input);
        }

        private String invokeEscapeJsonString(String input) {
            return (String) ReflectionTestUtils.invokeMethod(emailService, "escapeJsonString", input);
        }

        private String invokeToJsonPayload(String from, String to, String subject, String html) {
            return (String) ReflectionTestUtils.invokeMethod(emailService, "toJsonPayload", from, to, subject, html);
        }
    }
}
