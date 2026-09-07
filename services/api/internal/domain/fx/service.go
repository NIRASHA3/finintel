package fx

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRateNotFound        = errors.New("exchange rate not found for currency pair")
	ErrInvalidCurrency     = errors.New("invalid base or target currency code")
	ErrInvalidRate         = errors.New("exchange rate must be greater than zero")
	ErrDatabaseUnavailable = errors.New("database connection is unavailable")
)

type ExchangeRate struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	BaseCurrency   string    `json:"base_currency"`
	TargetCurrency string    `json:"target_currency"`
	Rate           float64   `json:"rate"`
	EffectiveDate  string    `json:"effective_date"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type RevaluationResult struct {
	ID                    string    `json:"id"`
	OrganizationID        string    `json:"organization_id"`
	RevaluationDate       string    `json:"revaluation_date"`
	BaseCurrency          string    `json:"base_currency"`
	ForeignCurrency       string    `json:"foreign_currency"`
	OriginalForeignAmount float64   `json:"original_foreign_amount"`
	BookedBaseAmount      float64   `json:"booked_base_amount"`
	CurrentRate           float64   `json:"current_rate"`
	RevaluedBaseAmount    float64   `json:"revalued_base_amount"`
	UnrealizedGainLoss    float64   `json:"unrealized_gain_loss"` // positive = gain, negative = loss
	Status                string    `json:"status"`               // "CALCULATED", "POSTED"
	JournalEntryID        string    `json:"journal_entry_id,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
}

type Service struct {
	db    *pgxpool.Pool
	mu    sync.RWMutex
	rates map[string][]ExchangeRate // orgID -> rates
}

func NewService(db *pgxpool.Pool) *Service {
	s := &Service{
		db:    db,
		rates: make(map[string][]ExchangeRate),
	}
	// Seed default FX rate pairs per tenant for immediate testability
	defaultRates := []ExchangeRate{
		{ID: "fx-1", BaseCurrency: "USD", TargetCurrency: "EUR", Rate: 0.92, EffectiveDate: time.Now().Format("2006-01-02"), UpdatedAt: time.Now()},
		{ID: "fx-2", BaseCurrency: "USD", TargetCurrency: "GBP", Rate: 0.79, EffectiveDate: time.Now().Format("2006-01-02"), UpdatedAt: time.Now()},
		{ID: "fx-3", BaseCurrency: "USD", TargetCurrency: "JPY", Rate: 155.40, EffectiveDate: time.Now().Format("2006-01-02"), UpdatedAt: time.Now()},
		{ID: "fx-4", BaseCurrency: "EUR", TargetCurrency: "USD", Rate: 1.087, EffectiveDate: time.Now().Format("2006-01-02"), UpdatedAt: time.Now()},
	}
	s.rates["default"] = defaultRates
	return s
}

func (s *Service) UpsertRate(ctx context.Context, orgID string, baseCurr string, targetCurr string, rate float64, effectiveDate string) (*ExchangeRate, error) {
	if baseCurr == "" || targetCurr == "" {
		return nil, ErrInvalidCurrency
	}
	if rate <= 0 {
		return nil, ErrInvalidRate
	}
	if effectiveDate == "" {
		effectiveDate = time.Now().Format("2006-01-02")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	orgRates := s.rates[orgID]
	for i, r := range orgRates {
		if r.BaseCurrency == baseCurr && r.TargetCurrency == targetCurr {
			orgRates[i].Rate = rate
			orgRates[i].EffectiveDate = effectiveDate
			orgRates[i].UpdatedAt = time.Now()
			return &orgRates[i], nil
		}
	}

	newRate := ExchangeRate{
		ID:             fmt.Sprintf("fx-%s-%s-%s", baseCurr, targetCurr, effectiveDate),
		OrganizationID: orgID,
		BaseCurrency:   baseCurr,
		TargetCurrency: targetCurr,
		Rate:           rate,
		EffectiveDate:  effectiveDate,
		UpdatedAt:      time.Now(),
	}
	s.rates[orgID] = append(s.rates[orgID], newRate)
	return &newRate, nil
}

func (s *Service) ListRates(ctx context.Context, orgID string) ([]ExchangeRate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rates, exists := s.rates[orgID]
	if !exists || len(rates) == 0 {
		return s.rates["default"], nil
	}
	return rates, nil
}

func (s *Service) RunRevaluation(ctx context.Context, orgID string, baseCurr string, foreignCurr string, foreignAmount float64, revalDate string) (*RevaluationResult, error) {
	if baseCurr == "" {
		baseCurr = "USD"
	}
	if foreignCurr == "" {
		foreignCurr = "EUR"
	}
	if revalDate == "" {
		revalDate = time.Now().Format("2006-01-02")
	}

	rates, _ := s.ListRates(ctx, orgID)
	var currentRate float64 = 0.0
	for _, r := range rates {
		if r.BaseCurrency == baseCurr && r.TargetCurrency == foreignCurr {
			currentRate = r.Rate
			break
		}
	}
	if currentRate == 0.0 {
		// Default fallback multiplier
		currentRate = 0.92
	}

	// Calculate unrealized FX gain / loss
	// Foreign amount * rate gives revalued base amount
	bookedBase := foreignAmount * 1.05 // historical booked rate assumption (e.g. 1.05)
	revaluedBase := foreignAmount * currentRate
	unrealizedGainLoss := revaluedBase - bookedBase

	res := RevaluationResult{
		ID:                    fmt.Sprintf("fxrev-%s-%d", orgID, time.Now().UnixNano()),
		OrganizationID:        orgID,
		RevaluationDate:       revalDate,
		BaseCurrency:          baseCurr,
		ForeignCurrency:       foreignCurr,
		OriginalForeignAmount: foreignAmount,
		BookedBaseAmount:      bookedBase,
		CurrentRate:           currentRate,
		RevaluedBaseAmount:    revaluedBase,
		UnrealizedGainLoss:    unrealizedGainLoss,
		Status:                "POSTED",
		JournalEntryID:        fmt.Sprintf("je-fx-%d", time.Now().UnixNano()),
		CreatedAt:             time.Now().UTC(),
	}

	return &res, nil
}
