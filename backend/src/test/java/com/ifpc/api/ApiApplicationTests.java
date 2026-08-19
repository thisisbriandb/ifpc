package com.ifpc.api;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * Smoke test verifying the main class entry point.
 * Does not load the Spring application context (would require a running database).
 */
class ApiApplicationTests {

	@Test
	void mainClassExists() {
		assertDoesNotThrow(() -> {
			// Verify the ApiApplication class can be loaded
			Class.forName("com.ifpc.api.ApiApplication");
		});
	}
}
