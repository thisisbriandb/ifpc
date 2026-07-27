package com.ifpc.api.services;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@SpringBootTest
class EmailServiceTest {

    @Autowired
    private EmailService emailService;

    @Test
    void testSendNewRegistrationNotificationDoesNotThrow() {
        User user = User.builder()
                .firstName("Jean")
                .lastName("Dupont")
                .email("jean.dupont@example.com")
                .companyName("Cidrerie test")
                .companyRole("Responsable Qualité")
                .role(Role.PENDING)
                .build();

        assertDoesNotThrow(() -> emailService.sendNewRegistrationNotification(user));
    }

    @Test
    void testSendAccountApprovedNotificationDoesNotThrow() {
        User user = User.builder()
                .firstName("Jean")
                .lastName("Dupont")
                .email("jean.dupont@example.com")
                .companyName("Cidrerie test")
                .companyRole("Responsable Qualité")
                .role(Role.USER)
                .build();

        assertDoesNotThrow(() -> emailService.sendAccountApprovedNotification(user));
    }
}
