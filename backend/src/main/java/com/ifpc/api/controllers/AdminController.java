package com.ifpc.api.controllers;

import com.ifpc.api.models.Role;
import com.ifpc.api.models.User;
import com.ifpc.api.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepository;

    @GetMapping("/users")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        List<UserDto> users = userRepository.findAll().stream()
                .map(user -> new UserDto(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getRole().name()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<String> updateUserRole(@PathVariable Long userId, @RequestBody RoleUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        
        try {
            Role newRole = Role.valueOf(request.role().toUpperCase());
            user.setRole(newRole);
            userRepository.save(user);
            return ResponseEntity.ok("Le rôle de " + user.getEmail() + " a été mis à jour vers " + newRole);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Rôle invalide. Utilisez USER, EXPERT ou ADMIN.");
        }
    }

    public record UserDto(Long id, String firstName, String lastName, String email, String role) {}
    public record RoleUpdateRequest(String role) {}
}
