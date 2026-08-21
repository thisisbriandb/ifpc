package com.ifpc.api.security;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import org.junit.jupiter.api.*;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link JwtService}.
 * Tests token generation, validation, expiration, and claim extraction.
 */
class JwtServiceTest {

    // Clé HS256 valable uniquement pour ces tests — jamais celle d'un
    // environnement réel, qui ne doit exister que dans JWT_SECRET.
    private static final String TEST_SECRET_B64 =
            java.util.Base64.getEncoder().encodeToString("jwt-service-unit-test-signing-key".getBytes());


    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        // Use the default secret key (same as in application)
        ReflectionTestUtils.setField(jwtService, "secretKey",
                TEST_SECRET_B64);
        ReflectionTestUtils.setField(jwtService, "jwtExpiration", 86400000L); // 24h
    }

    private User buildUser(String email, Role role) {
        return User.builder()
                .email(email)
                .password("encoded-password")
                .firstName("Test")
                .lastName("User")
                .role(role)
                .enabled(true)
                .build();
    }

    // ── Token generation ────────────────────────────────────────────────────

    @Nested
    @DisplayName("generateToken")
    class GenerateToken {

        @Test
        @DisplayName("should generate a non-null JWT token")
        void generatesToken() {
            User user = buildUser("test@ifpc.eu", Role.USER);
            String token = jwtService.generateToken(user);
            assertNotNull(token);
            assertFalse(token.isBlank());
        }

        @Test
        @DisplayName("should generate different tokens for different users")
        void differentTokens() {
            User user1 = buildUser("alice@ifpc.eu", Role.USER);
            User user2 = buildUser("bob@ifpc.eu", Role.ADMIN);

            String token1 = jwtService.generateToken(user1);
            String token2 = jwtService.generateToken(user2);

            assertNotEquals(token1, token2);
        }
    }

    // ── Username extraction ─────────────────────────────────────────────────

    @Nested
    @DisplayName("extractUsername")
    class ExtractUsername {

        @Test
        @DisplayName("should extract the correct email from token")
        void extractsUsername() {
            User user = buildUser("marie@ifpc.eu", Role.EXPERT);
            String token = jwtService.generateToken(user);

            String extracted = jwtService.extractUsername(token);
            assertEquals("marie@ifpc.eu", extracted);
        }
    }

    // ── Token validation ────────────────────────────────────────────────────

    @Nested
    @DisplayName("isTokenValid")
    class IsTokenValid {

        @Test
        @DisplayName("should return true for valid token matching user")
        void validToken() {
            User user = buildUser("valid@ifpc.eu", Role.USER);
            String token = jwtService.generateToken(user);

            assertTrue(jwtService.isTokenValid(token, user));
        }

        @Test
        @DisplayName("should return false when token user doesn't match")
        void wrongUser() {
            User user1 = buildUser("alice@ifpc.eu", Role.USER);
            User user2 = buildUser("bob@ifpc.eu", Role.USER);

            String token = jwtService.generateToken(user1);
            assertFalse(jwtService.isTokenValid(token, user2));
        }

        @Test
        @DisplayName("should return false for expired token")
        void expiredToken() {
            JwtService shortLived = new JwtService();
            ReflectionTestUtils.setField(shortLived, "secretKey",
                    TEST_SECRET_B64);
            ReflectionTestUtils.setField(shortLived, "jwtExpiration", -1000L); // already expired

            User user = buildUser("expired@ifpc.eu", Role.USER);
            String token = shortLived.generateToken(user);

            assertThrows(Exception.class, () -> jwtService.isTokenValid(token, user));
        }
    }

    // ── Claim extraction ────────────────────────────────────────────────────

    @Nested
    @DisplayName("extractClaim")
    class ExtractClaim {

        @Test
        @DisplayName("should extract role claim from token")
        void extractRole() {
            User user = buildUser("admin@ifpc.eu", Role.ADMIN);
            String token = jwtService.generateToken(user);

            String role = jwtService.extractClaim(token, claims -> claims.get("role", String.class));
            assertEquals("ROLE_ADMIN", role);
        }

        @Test
        @DisplayName("should extract USER role claim")
        void extractUserRole() {
            User user = buildUser("user@ifpc.eu", Role.USER);
            String token = jwtService.generateToken(user);

            String role = jwtService.extractClaim(token, claims -> claims.get("role", String.class));
            assertEquals("ROLE_USER", role);
        }

        @Test
        @DisplayName("should extract EXPERT role claim")
        void extractExpertRole() {
            User user = buildUser("expert@ifpc.eu", Role.EXPERT);
            String token = jwtService.generateToken(user);

            String role = jwtService.extractClaim(token, claims -> claims.get("role", String.class));
            assertEquals("ROLE_EXPERT", role);
        }

        @Test
        @DisplayName("should extract PENDING role claim")
        void extractPendingRole() {
            User user = buildUser("pending@ifpc.eu", Role.PENDING);
            String token = jwtService.generateToken(user);

            String role = jwtService.extractClaim(token, claims -> claims.get("role", String.class));
            assertEquals("ROLE_PENDING", role);
        }
    }

    // ── Edge cases ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("edge cases")
    class EdgeCases {

        @Test
        @DisplayName("should throw on malformed token")
        void malformedToken() {
            assertThrows(Exception.class, () -> jwtService.extractUsername("not-a-jwt-token"));
        }

        @Test
        @DisplayName("should throw on empty token")
        void emptyToken() {
            assertThrows(Exception.class, () -> jwtService.extractUsername(""));
        }
    }
}
