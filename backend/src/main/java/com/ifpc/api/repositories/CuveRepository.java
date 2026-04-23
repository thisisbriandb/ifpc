package com.ifpc.api.repositories;

import com.ifpc.api.models.Cuve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CuveRepository extends JpaRepository<Cuve, Long> {
}
