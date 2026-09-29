package dev.sysflow.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :id")
    Optional<Project> findByIdForUpdate(@Param("id") UUID id);

    List<Project> findByUserIdOrderByUpdatedAtDesc(UUID userId);

    List<Project> findByIsPublicTemplateTrueOrderByUpdatedAtDesc();

    Optional<Project> findByShareToken(UUID shareToken);
}
