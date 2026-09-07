package anomaly

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
)

type Anomaly struct {
	ID              string    `json:"id"`
	Type            string    `json:"type"`            // DUPLICATE_REFERENCE, OUTLIER_AMOUNT, UNMAPPED_PAYEE
	Severity        string    `json:"severity"`        // HIGH, MEDIUM, LOW
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	ConfidenceScore float64   `json:"confidenceScore"`
	SuggestedAction string    `json:"suggestedAction"`
	CreatedAt       time.Time `json:"createdAt"`
	RelatedEntityID string    `json:"relatedEntityId,omitempty"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

func (s *Service) ScanAnomalies(ctx context.Context, orgID string) ([]Anomaly, error) {
	if s.db == nil {
		return nil, ErrDatabaseUnavailable
	}

	var anomalies []Anomaly

	// 1. Scan for Duplicate References in Staged Transactions & Journal Entries
	dupQuery := `
		SELECT id, reference_number, payee, amount_minor_units, created_at
		FROM staged_transactions
		WHERE organization_id = $1 AND reference_number IS NOT NULL AND reference_number != ''
		AND reference_number IN (
			SELECT reference_number 
			FROM staged_transactions 
			WHERE organization_id = $1 AND reference_number IS NOT NULL AND reference_number != ''
			GROUP BY reference_number 
			HAVING COUNT(*) > 1
		)
		ORDER BY created_at DESC;
	`
	rows, err := s.db.Query(ctx, dupQuery, orgID)
	if err == nil {
		for rows.Next() {
			var id, ref, payee string
			var amt int64
			var createdAt time.Time
			if err := rows.Scan(&id, &ref, &payee, &amt, &createdAt); err == nil {
				anomalies = append(anomalies, Anomaly{
					ID:              fmt.Sprintf("anom-dup-%s", id[:8]),
					Type:            "DUPLICATE_REFERENCE",
					Severity:        "HIGH",
					Title:           fmt.Sprintf("Duplicate Reference Code '%s'", ref),
					Description:     fmt.Sprintf("Transaction for '%s' ($%.2f) re-uses reference code '%s' already recorded in staged transactions.", payee, float64(amt)/100.0, ref),
					ConfidenceScore: 0.94,
					SuggestedAction: "Verify invoice or reference payload hash to prevent double-payment.",
					CreatedAt:       createdAt,
					RelatedEntityID: id,
				})
			}
		}
		rows.Close()
	}

	// 2. Scan for Outlier Transaction Amounts (> $50,000 or > 3x average)
	outlierQuery := `
		SELECT id, transaction_date::text, description, status, created_at,
		       (SELECT COALESCE(SUM(debit_amount_minor_units), 0) FROM journal_entry_lines WHERE journal_entry_id = je.id) as total_debit
		FROM journal_entries je
		WHERE organization_id = $1
		ORDER BY created_at DESC;
	`
	jRows, err := s.db.Query(ctx, outlierQuery, orgID)
	if err == nil {
		var totalSum int64
		var count int64
		type jItem struct {
			id        string
			date      string
			desc      string
			status    string
			createdAt time.Time
			amount    int64
		}
		var items []jItem
		for jRows.Next() {
			var ji jItem
			if err := jRows.Scan(&ji.id, &ji.date, &ji.desc, &ji.status, &ji.createdAt, &ji.amount); err == nil {
				items = append(items, ji)
				totalSum += ji.amount
				count++
			}
		}
		jRows.Close()

		if count > 0 {
			avg := totalSum / count
			threshold := avg * 3
			if threshold < 5000000 { // minimum threshold of $50,000 (5,000,000 minor units)
				threshold = 5000000
			}

			for _, ji := range items {
				if ji.amount > threshold {
					anomalies = append(anomalies, Anomaly{
						ID:              fmt.Sprintf("anom-out-%s", ji.id[:8]),
						Type:            "OUTLIER_AMOUNT",
						Severity:        "HIGH",
						Title:           fmt.Sprintf("High-Value Outlier Entry ($%.2f)", float64(ji.amount)/100.0),
						Description:     fmt.Sprintf("Journal Entry '%s' ($%.2f) exceeds 3x average entry threshold ($%.2f).", ji.desc, float64(ji.amount)/100.0, float64(threshold)/100.0),
						ConfidenceScore: 0.91,
						SuggestedAction: "Review support documentation and manager sign-off for large entry.",
						CreatedAt:       ji.createdAt,
						RelatedEntityID: ji.id,
					})
				}
			}
		}
	}

	// 3. Scan for Unmapped Payees in Staged Transactions
	unmappedQuery := `
		SELECT id, payee, amount_minor_units, created_at
		FROM staged_transactions
		WHERE organization_id = $1 AND (suggested_category IS NULL OR suggested_category = '' OR suggested_category = 'Uncategorized')
		ORDER BY created_at DESC;
	`
	uRows, err := s.db.Query(ctx, unmappedQuery, orgID)
	if err == nil {
		for uRows.Next() {
			var id, payee string
			var amt int64
			var createdAt time.Time
			if err := uRows.Scan(&id, &payee, &amt, &createdAt); err == nil {
				anomalies = append(anomalies, Anomaly{
					ID:              fmt.Sprintf("anom-unm-%s", id[:8]),
					Type:            "UNMAPPED_PAYEE",
					Severity:        "MEDIUM",
					Title:           fmt.Sprintf("Unmapped Payee '%s'", payee),
					Description:     fmt.Sprintf("Staged transaction for payee '%s' ($%.2f) requires chart of accounts mapping.", payee, float64(amt)/100.0),
					ConfidenceScore: 0.82,
					SuggestedAction: "Map payee to appropriate General Ledger expense account before posting.",
					CreatedAt:       createdAt,
					RelatedEntityID: id,
				})
			}
		}
		uRows.Close()
	}

	if anomalies == nil {
		anomalies = []Anomaly{}
	}

	return anomalies, nil
}
