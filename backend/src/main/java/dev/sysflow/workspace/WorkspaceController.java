package dev.sysflow.workspace;

import dev.sysflow.auth.User;
import dev.sysflow.auth.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/workspaces")
public class WorkspaceController {

    private final WorkspaceRepository workspaceRepo;
    private final WorkspaceMemberRepository memberRepo;
    private final UserRepository userRepo;

    public WorkspaceController(WorkspaceRepository workspaceRepo, WorkspaceMemberRepository memberRepo, UserRepository userRepo) {
        this.workspaceRepo = workspaceRepo;
        this.memberRepo = memberRepo;
        this.userRepo = userRepo;
    }

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }

    record CreateRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 100) String name) {}
    record WorkspaceResponse(UUID id, String name, String slug, String plan, String role, int memberCount) {}
    record MemberResponse(UUID userId, String email, String displayName, String role) {}
    record InviteRequest(String email, String role) {}

    @PostMapping
    @Transactional
    public WorkspaceResponse create(@jakarta.validation.Valid @RequestBody CreateRequest req, Authentication auth) {
        UUID uid = userId(auth);
        String base = req.name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        if (base.isEmpty()) base = "workspace";
        // ponytail: always append random suffix to avoid TOCTOU slug collision
        String slug = base + "-" + UUID.randomUUID().toString().substring(0, 6);

        Workspace ws = new Workspace(req.name, slug, uid);
        workspaceRepo.save(ws);
        memberRepo.save(new WorkspaceMember(ws.getId(), uid, WorkspaceMember.MemberRole.OWNER));
        return new WorkspaceResponse(ws.getId(), ws.getName(), ws.getSlug(), ws.getPlan(), "OWNER", 1);
    }

    @GetMapping
    public List<WorkspaceResponse> list(Authentication auth) {
        UUID uid = userId(auth);
        List<WorkspaceMember> memberships = memberRepo.findByUserId(uid);
        if (memberships.isEmpty()) return List.of();
        Set<UUID> wsIds = memberships.stream().map(WorkspaceMember::getWorkspaceId).collect(Collectors.toSet());
        Map<UUID, Workspace> wsById = workspaceRepo.findAllById(wsIds).stream()
                .collect(Collectors.toMap(Workspace::getId, w -> w));
        Map<UUID, Long> countByWs = memberRepo.findByWorkspaceId(wsIds.iterator().next()) != null
                ? wsIds.stream().collect(Collectors.toMap(id -> id, id -> (long) memberRepo.findByWorkspaceId(id).size()))
                : Map.of();
        return memberships.stream().map(m -> {
            Workspace ws = wsById.get(m.getWorkspaceId());
            if (ws == null) return null;
            return new WorkspaceResponse(ws.getId(), ws.getName(), ws.getSlug(), ws.getPlan(), m.getRole().name(), countByWs.getOrDefault(m.getWorkspaceId(), 0L).intValue());
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    @GetMapping("/{id}/members")
    public List<MemberResponse> members(@PathVariable UUID id, Authentication auth) {
        UUID uid = userId(auth);
        memberRepo.findByWorkspaceIdAndUserId(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
        List<WorkspaceMember> wsMembers = memberRepo.findByWorkspaceId(id);
        Set<UUID> userIds = wsMembers.stream().map(WorkspaceMember::getUserId).collect(Collectors.toSet());
        Map<UUID, User> usersById = userRepo.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        return wsMembers.stream().map(m -> {
            User u = usersById.get(m.getUserId());
            return u == null ? null : new MemberResponse(u.getId(), u.getEmail(), u.getDisplayName(), m.getRole().name());
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    @PostMapping("/{id}/members")
    @Transactional
    public MemberResponse invite(@PathVariable UUID id, @RequestBody InviteRequest req, Authentication auth) {
        UUID uid = userId(auth);
        WorkspaceMember caller = memberRepo.findByWorkspaceIdAndUserId(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
        if (caller.getRole() != WorkspaceMember.MemberRole.OWNER && caller.getRole() != WorkspaceMember.MemberRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only owners and admins can invite members");
        }
        User invitee = userRepo.findByEmail(req.email.trim().toLowerCase(java.util.Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No user with that email"));
        WorkspaceMember.MemberRole role;
        try { role = WorkspaceMember.MemberRole.valueOf(req.role.toUpperCase()); } catch (Exception e) { role = WorkspaceMember.MemberRole.MEMBER; }
        if (role == WorkspaceMember.MemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "OWNER role cannot be granted via invite");
        }
        if (memberRepo.findByWorkspaceIdAndUserId(id, invitee.getId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already a member");
        }
        memberRepo.save(new WorkspaceMember(id, invitee.getId(), role));
        return new MemberResponse(invitee.getId(), invitee.getEmail(), invitee.getDisplayName(), role.name());
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @Transactional
    public void removeMember(@PathVariable UUID id, @PathVariable UUID memberId, Authentication auth) {
        UUID uid = userId(auth);
        WorkspaceMember caller = memberRepo.findByWorkspaceIdAndUserId(id, uid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
        if (caller.getRole() != WorkspaceMember.MemberRole.OWNER && caller.getRole() != WorkspaceMember.MemberRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        WorkspaceMember target = memberRepo.findByWorkspaceIdAndUserId(id, memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));
        if (target.getRole() == WorkspaceMember.MemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot remove the workspace owner");
        }
        memberRepo.delete(target);
    }
}
