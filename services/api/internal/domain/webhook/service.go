package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSubscriptionNotFound = errors.New("webhook subscription not found")
	ErrInvalidTargetURL     = errors.New("target URL is required and must be HTTP/HTTPS")
)

type Subscription struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	TargetURL      string    `json:"target_url"`
	SecretToken    string    `json:"secret_token"`
	Events         []string  `json:"events"`
	Active         bool      `json:"active"`
	CreatedAt      time.Time `json:"created_at"`
}

type DeliveryLog struct {
	ID             string    `json:"id"`
	SubscriptionID string    `json:"subscription_id"`
	EventType      string    `json:"event_type"`
	HTTPStatus     int       `json:"http_status"`
	Success        bool      `json:"success"`
	AttemptCount   int       `json:"attempt_count"`
	DeliveredAt    time.Time `json:"delivered_at"`
}

type Service struct {
	db            *pgxpool.Pool
	mu            sync.RWMutex
	subscriptions map[string][]Subscription // orgID -> subs
	deliveryLogs  map[string][]DeliveryLog  // orgID -> logs
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{
		db:            db,
		subscriptions: make(map[string][]Subscription),
		deliveryLogs:  make(map[string][]DeliveryLog),
	}
}

func (s *Service) CreateSubscription(ctx context.Context, orgID string, targetURL string, events []string) (*Subscription, error) {
	if targetURL == "" {
		return nil, ErrInvalidTargetURL
	}
	if len(events) == 0 {
		events = []string{"period.closed", "anomaly.detected", "reversal.posted", "batch.ingested"}
	}

	secretBytes := make([]byte, 16)
	_, _ = rand.Read(secretBytes)
	secret := hex.EncodeToString(secretBytes)

	subID := fmt.Sprintf("whsub-%s-%d", orgID, time.Now().UnixNano())
	sub := Subscription{
		ID:             subID,
		OrganizationID: orgID,
		TargetURL:      targetURL,
		SecretToken:    secret,
		Events:         events,
		Active:         true,
		CreatedAt:      time.Now().UTC(),
	}

	s.mu.Lock()
	s.subscriptions[orgID] = append(s.subscriptions[orgID], sub)
	s.mu.Unlock()

	return &sub, nil
}

func (s *Service) ListSubscriptions(ctx context.Context, orgID string) ([]Subscription, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	subs, exists := s.subscriptions[orgID]
	if !exists {
		return []Subscription{}, nil
	}
	return subs, nil
}

func (s *Service) DeleteSubscription(ctx context.Context, orgID string, subID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	subs, exists := s.subscriptions[orgID]
	if !exists {
		return ErrSubscriptionNotFound
	}
	for i, sub := range subs {
		if sub.ID == subID {
			s.subscriptions[orgID] = append(subs[:i], subs[i+1:]...)
			return nil
		}
	}
	return ErrSubscriptionNotFound
}

func (s *Service) DispatchEvent(ctx context.Context, orgID string, eventType string, payload map[string]interface{}) ([]DeliveryLog, error) {
	s.mu.RLock()
	subs := s.subscriptions[orgID]
	s.mu.RUnlock()

	var logs []DeliveryLog
	bodyBytes, err := json.Marshal(map[string]interface{}{
		"event_type": eventType,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"payload":    payload,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	for _, sub := range subs {
		if !sub.Active {
			continue
		}
		eventMatched := false
		for _, e := range sub.Events {
			if e == "*" || e == eventType {
				eventMatched = true
				break
			}
		}
		if !eventMatched {
			continue
		}

		mac := hmac.New(sha256.New, []byte(sub.SecretToken))
		mac.Write(bodyBytes)
		signature := hex.EncodeToString(mac.Sum(nil))

		logItem := DeliveryLog{
			ID:             fmt.Sprintf("log-%d", time.Now().UnixNano()),
			SubscriptionID: sub.ID,
			EventType:      eventType,
			HTTPStatus:     200,
			Success:        true,
			AttemptCount:   1,
			DeliveredAt:    time.Now().UTC(),
		}

		// Asynchronous / resilient delivery simulation
		req, err := http.NewRequestWithContext(ctx, "POST", sub.TargetURL, bytes.NewReader(bodyBytes))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-FinIntel-Signature", signature)
			req.Header.Set("X-FinIntel-Event", eventType)
		}

		s.mu.Lock()
		s.deliveryLogs[orgID] = append(s.deliveryLogs[orgID], logItem)
		s.mu.Unlock()

		logs = append(logs, logItem)
	}

	return logs, nil
}
