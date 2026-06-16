package com.ifpc.api.repositories;

import com.ifpc.api.models.ProductConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

import java.util.List;

public interface ProductConfigRepository extends JpaRepository<ProductConfig, Long> {
    Optional<ProductConfig> findByProductType(String productType);

    Optional<ProductConfig> findByProductTypeAndUserId(String productType, Long userId);
    List<ProductConfig> findByUserId(Long userId);
}
