package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type ipLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// IPRateLimiter tracks rate limiters by client IP.
type IPRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiterEntry
	r        rate.Limit
	b        int
}

// NewIPRateLimiter initializes a rate limiter with token refill rate r and burst size b.
func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	limiter := &IPRateLimiter{
		limiters: make(map[string]*ipLimiterEntry),
		r:        r,
		b:        b,
	}

	// Periodically clean up stale entries (every 10 minutes)
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			limiter.mu.Lock()
			for ip, entry := range limiter.limiters {
				if time.Since(entry.lastSeen) > 30*time.Minute {
					delete(limiter.limiters, ip)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

// GetLimiter returns the rate.Limiter for a given IP address.
func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	entry, exists := i.limiters[ip]
	if !exists {
		limiter := rate.NewLimiter(i.r, i.b)
		i.limiters[ip] = &ipLimiterEntry{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	entry.lastSeen = time.Now()
	return entry.limiter
}

// Handler returns a Chi middleware function enforcing rate limits.
func (i *IPRateLimiter) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		limiter := i.GetLimiter(ip)

		if !limiter.Allow() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":   "Too Many Requests",
				"message": "Rate limit exceeded. Please try again later.",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RateLimit returns a middleware with rate r (events per sec) and burst b.
func RateLimit(r rate.Limit, b int) func(next http.Handler) http.Handler {
	limiter := NewIPRateLimiter(r, b)
	return limiter.Handler
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fallback to RemoteAddr
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
