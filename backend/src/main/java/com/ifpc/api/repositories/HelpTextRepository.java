package com.ifpc.api.repositories;

import com.ifpc.api.models.HelpText;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HelpTextRepository extends JpaRepository<HelpText, Long> {
    Optional<HelpText> findByTextKey(String textKey);
}
