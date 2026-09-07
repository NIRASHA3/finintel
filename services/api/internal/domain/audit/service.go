package audit

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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

func EncodeCursor(t time.Time, id string) string {
	str := fmt.Sprintf("%s|%s", t.Format(time.RFC3339Nano), id)
	return base64.URLEncoding.EncodeToString([]byte(str))
}

func DecodeCursor(cursor string) (time.Time, string, error) {
	data, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", fmt.Errorf("invalid base64 cursor: %w", err)
	}
	parts := strings.SplitN(string(data), "|", 2)
	if len(parts) != 2 {
		return time.Time{}, "", fmt.Errorf("invalid cursor format")
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("invalid cursor timestamp: %w", err)
	}
	return t, parts[1], nil
}

// ListAuditLogs retrieves audit logs for an organization using keyset cursor pagination.
func (s *Service) ListAuditLogs(ctx context.Context, orgID string, cursor string, limit int) ([]AuditLog, string, error) {
	if s.db == nil {
		return nil, "", ErrDatabaseUnavailable
	}

	if limit <= 0 || limit > 500 {
		limit = 100
	}

	var rows pgx.Rows
	var err error

	if strings.TrimSpace(cursor) != "" {
		cursorTime, cursorID, errDecode := DecodeCursor(cursor)
		if errDecode != nil {
			return nil, "", fmt.Errorf("bad cursor: %w", errDecode)
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
			WHERE al.organization_id = $1 AND (al.created_at < $2 OR (al.created_at = $2 AND al.id < $3))
			ORDER BY al.created_at DESC, al.id DESC
			LIMIT $4;
		`
		rows, err = s.db.Query(ctx, query, orgID, cursorTime, cursorID, limit+1)
	} else {
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
			ORDER BY al.created_at DESC, al.id DESC
			LIMIT $2;
		`
		rows, err = s.db.Query(ctx, query, orgID, limit+1)
	}

	if err != nil {
		return nil, "", fmt.Errorf("failed to query audit logs: %w", err)
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
			return nil, "", fmt.Errorf("failed to scan audit log row: %w", err)
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

	nextCursor := ""
	if len(logs) > limit {
		nextCursor = EncodeCursor(logs[limit-1].CreatedAt, logs[limit-1].ID)
		logs = logs[:limit]
	}

	return logs, nextCursor, nil
}

func jsonUnmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
