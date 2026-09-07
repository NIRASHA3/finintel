package export

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) ExportGeneralLedgerCSV(ctx context.Context, orgID string) (string, error) {
	if s.db == nil {
		return "", ErrDatabaseUnavailable
	}

	query := `
		SELECT je.entry_number, je.transaction_date::text, je.description, je.status,
		       a.account_code, a.name as account_name, a.account_type,
		       jel.debit_amount_minor_units, jel.credit_amount_minor_units, COALESCE(jel.memo, '')
		FROM journal_entries je
		JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
		JOIN accounts a ON jel.account_id = a.id
		WHERE je.organization_id = $1
		ORDER BY je.entry_number ASC, jel.id ASC;
	`
	rows, err := s.db.Query(ctx, query, orgID)
	if err != nil {
		return "", fmt.Errorf("failed to query general ledger for export: %w", err)
	}
	defer rows.Close()

	buf := &bytes.Buffer{}
	writer := csv.NewWriter(buf)

	// Write CSV Header
	_ = writer.Write([]string{
		"Entry Number", "Date", "Description", "Status",
		"Account Code", "Account Name", "Account Type",
		"Debit (USD)", "Credit (USD)", "Debit Minor Units", "Credit Minor Units", "Memo",
	})

	for rows.Next() {
		var entryNum int64
		var date, desc, status, code, name, accType, memo string
		var debit, credit int64

		if err := rows.Scan(&entryNum, &date, &desc, &status, &code, &name, &accType, &debit, &credit, &memo); err == nil {
			_ = writer.Write([]string{
				fmt.Sprintf("%d", entryNum),
				date,
				desc,
				status,
				code,
				name,
				accType,
				fmt.Sprintf("%.2f", float64(debit)/100.0),
				fmt.Sprintf("%.2f", float64(credit)/100.0),
				fmt.Sprintf("%d", debit),
				fmt.Sprintf("%d", credit),
				memo,
			})
		}
	}
	writer.Flush()

	return buf.String(), nil
}

func (s *Service) ExportAuditLogsCSV(ctx context.Context, orgID string) (string, error) {
	if s.db == nil {
		return "", ErrDatabaseUnavailable
	}

	query := `
		SELECT al.id, al.created_at, COALESCE(u.full_name, 'System Worker') as actor,
		       al.actor_type, al.correlation_id, al.entity_type, al.entity_id, al.action, al.changes::text
		FROM audit_logs al
		LEFT JOIN users u ON al.actor_id = u.id
		WHERE al.organization_id = $1
		ORDER BY al.created_at DESC;
	`
	rows, err := s.db.Query(ctx, query, orgID)
	if err != nil {
		return "", fmt.Errorf("failed to query audit logs for export: %w", err)
	}
	defer rows.Close()

	buf := &bytes.Buffer{}
	writer := csv.NewWriter(buf)

	_ = writer.Write([]string{
		"Audit Log ID", "Timestamp (UTC)", "Actor Name", "Actor Type",
		"Correlation ID", "Entity Type", "Entity ID", "Action", "Changes JSON",
	})

	for rows.Next() {
		var id, actor, actorType, corrID, entityType, entityID, action, changes string
		var createdAt time.Time

		if err := rows.Scan(&id, &createdAt, &actor, &actorType, &corrID, &entityType, &entityID, &action, &changes); err == nil {
			_ = writer.Write([]string{
				id,
				createdAt.Format(time.RFC3339),
				actor,
				actorType,
				corrID,
				entityType,
				entityID,
				action,
				changes,
			})
		}
	}
	writer.Flush()

	return buf.String(), nil
}
