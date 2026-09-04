package audit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrDatabaseUnavailable = errors.New("database connection is unavailable")

type AuditLog struct {
	ID             string                 `json:"id"`
	OrganizationID string                 `json:"organizationId"`
	ActorID        string                 `json:"actorId,omitempty"`
	ActorEmail     string                 `json:"actorEmail,omitempty"`
	ActorFullName  string                 `json:"actorFullName,omitempty"`
	ActorType      string                 `json:"actorType"`
	CorrelationID  string                 `json:"correlationId"`
	EntityType     string                 `json:"entityType"`
	EntityID       string                 `json:"entityId"`
	Action         string                 `json:"action"`
	Changes        map[string]interface{} `json:"changes"`
	CreatedAt      time.Time              `json:"createdAt"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// ListAuditLogs retrieves audit logs for an organization.
func (s *Service) ListAuditLogs(ctx context.Context, orgID string, limit int) ([]AuditLog, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := `
		SELECT 
			al.id, 
			al.organization_id, 
			COALESCE(al.actor_id::text, ''), 
			COALESCE(u.email, ''), 
			COALESCE(u.full_name, ''), 
			al.actor_type, 
			al.correlation_id, 
			al.entity_type, 
			al.entity_id::text, 
			al.action, 
			al.changes, 
			al.created_at
		FROM audit_logs al
		LEFT JOIN users u ON al.actor_id = u.id
		WHERE al.organization_id = $1
		ORDER BY al.created_at DESC
		LIMIT $2;
	`

	rows, err := s.db.Query(ctx, query, orgID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		var rawChanges []byte

		err := rows.Scan(
			&log.ID,
			&log.OrganizationID,
			&log.ActorID,
			&log.ActorEmail,
			&log.ActorFullName,
			&log.ActorType,
			&log.CorrelationID,
			&log.EntityType,
			&log.EntityID,
			&log.Action,
			&rawChanges,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log row: %w", err)
		}

		if len(rawChanges) > 0 {
			_ = jsonUnmarshal(rawChanges, &log.Changes)
		}
		if log.Changes == nil {
			log.Changes = make(map[string]interface{})
		}

		logs = append(logs, log)
	}

	if logs == nil {
		logs = []AuditLog{}
	}

	return logs, nil
}

func jsonUnmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
