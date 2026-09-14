package oidc

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInfraFailure  = errors.New("JWKS infrastructure failure")
	ErrInvalidClaims = errors.New("invalid claims in token")
)

type Claims struct {
	Issuer    string   `json:"iss"`
	Audience  []string `json:"aud"`
	Subject   string   `json:"sub"`
	Email     string   `json:"email,omitempty"`
	FullName  string   `json:"name,omitempty"`
	ExpiresAt int64    `json:"exp"`
	NotBefore int64    `json:"nbf,omitempty"`
	IssuedAt  int64    `json:"iat,omitempty"`
}

type JSONWebKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type JSONWebKeySet struct {
	Keys []JSONWebKey `json:"keys"`
}

type ValidatorConfig struct {
	IssuerURL   string
	Audience    string
	JwksURL     string
	AllowedAlgs []string
	HTTPTimeout time.Duration
	ClockSkew   time.Duration
}

type Validator struct {
	cfg            ValidatorConfig
	httpClient     *http.Client
	mu             sync.RWMutex
	keys           map[string]*rsa.PublicKey
	keysFetchedAt  time.Time
	lastRefresh    time.Time
	lastRefreshErr error
}

func NewValidator(cfg ValidatorConfig) *Validator {
	if cfg.HTTPTimeout <= 0 {
		cfg.HTTPTimeout = 10 * time.Second
	}
	if cfg.ClockSkew <= 0 {
		cfg.ClockSkew = 1 * time.Minute
	}
	if cfg.JwksURL == "" {
		cfg.JwksURL = strings.TrimSuffix(cfg.IssuerURL, "/") + "/.well-known/jwks.json"
	}
	if len(cfg.AllowedAlgs) == 0 {
		cfg.AllowedAlgs = []string{"RS256"}
	}

	return &Validator{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: cfg.HTTPTimeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return errors.New("stopped after 10 redirects")
				}
				for _, prev := range via {
					if prev.URL.Scheme == "https" && req.URL.Scheme != "https" {
						return fmt.Errorf("insecure redirect downgrade from https to %s rejected", req.URL.Scheme)
					}
				}
				return nil
			},
		},
		keys: make(map[string]*rsa.PublicKey),
	}
}

func (v *Validator) ValidateToken(tokenString string) (*Claims, error) {
	if len(tokenString) > 8192 {
		return nil, errors.New("token exceeds maximum allowed size of 8KB")
	}

	tokenString = strings.TrimPrefix(tokenString, "Bearer ")
	tokenString = strings.TrimSpace(tokenString)

	parser := jwt.NewParser(
		jwt.WithValidMethods(v.cfg.AllowedAlgs),
		jwt.WithLeeway(v.cfg.ClockSkew),
	)

	token, err := parser.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		kid, ok := t.Header["kid"].(string)
		if !ok || kid == "" {
			return nil, errors.New("missing kid in token header")
		}

		key := v.getKey(kid)
		if key == nil {
			if err := v.refreshKeysRateLimited(); err != nil {
				return nil, fmt.Errorf("%w: failed to refresh JWKS keys: %v", ErrInfraFailure, err)
			}
			key = v.getKey(kid)
		}

		if key == nil {
			return nil, fmt.Errorf("unknown kid '%s'", kid)
		}
		return key, nil
	})

	if err != nil || token == nil || !token.Valid {
		if errors.Is(err, ErrInfraFailure) {
			return nil, err
		}
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	jwtClaims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid claims type")
	}

	claims, err := parseMapClaims(jwtClaims)
	if err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}

	// Validate mandatory claims: iss, aud, sub, exp
	if claims.Issuer == "" {
		return nil, errors.New("missing required issuer (iss) claim")
	}
	if len(claims.Audience) == 0 {
		return nil, errors.New("missing required audience (aud) claim")
	}
	if claims.Subject == "" {
		return nil, errors.New("missing required subject (sub) claim")
	}
	if claims.ExpiresAt == 0 {
		return nil, errors.New("missing required expiration (exp) claim")
	}

	// Exact Issuer comparison
	if claims.Issuer != v.cfg.IssuerURL {
		return nil, fmt.Errorf("issuer mismatch: got '%s', expected '%s'", claims.Issuer, v.cfg.IssuerURL)
	}

	// Audience comparison
	audMatches := false
	for _, aud := range claims.Audience {
		if aud == v.cfg.Audience {
			audMatches = true
			break
		}
	}
	if !audMatches {
		return nil, fmt.Errorf("audience mismatch: %v does not contain %s", claims.Audience, v.cfg.Audience)
	}

	// Optional nbf validation
	if claims.NotBefore > 0 {
		now := time.Now().Unix()
		leewaySec := int64(v.cfg.ClockSkew.Seconds())
		if now+leewaySec < claims.NotBefore {
			return nil, fmt.Errorf("token not valid before %d (current time: %d)", claims.NotBefore, now)
		}
	}

	return claims, nil
}

func (v *Validator) SetPublicKey(kid string, pubKey *rsa.PublicKey) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.keys[kid] = pubKey
	v.keysFetchedAt = time.Now()
}

func (v *Validator) getKey(kid string) *rsa.PublicKey {
	v.mu.RLock()
	defer v.mu.RUnlock()

	if time.Since(v.keysFetchedAt) > 1*time.Hour {
		return nil
	}
	return v.keys[kid]
}

func (v *Validator) refreshKeysRateLimited() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if time.Since(v.lastRefresh) < 10*time.Second {
		if v.lastRefreshErr != nil {
			return v.lastRefreshErr
		}
		return nil
	}

	v.lastRefresh = time.Now()

	req, err := http.NewRequest(http.MethodGet, v.cfg.JwksURL, nil)
	if err != nil {
		v.lastRefreshErr = err
		return err
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		v.lastRefreshErr = err
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		v.lastRefreshErr = fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
		return v.lastRefreshErr
	}

	// Limit JWKS body read to 100KB max
	limitedReader := io.LimitReader(resp.Body, 100*1024)
	var jwks JSONWebKeySet
	if err := json.NewDecoder(limitedReader).Decode(&jwks); err != nil {
		v.lastRefreshErr = err
		return err
	}

	newKeys := make(map[string]*rsa.PublicKey)
	for _, key := range jwks.Keys {
		if key.Kid == "" {
			continue
		}
		if key.Kty != "RSA" {
			continue
		}
		if key.Use != "" && key.Use != "sig" {
			continue
		}
		if key.Alg != "" && key.Alg != "RS256" {
			continue
		}
		if key.N == "" || key.E == "" {
			continue
		}

		pubKey, err := parseRSAPublicKey(key.N, key.E)
		if err == nil {
			// Enforce minimum RSA key strength of 2048 bits
			if pubKey.N != nil && pubKey.N.BitLen() >= 2048 {
				newKeys[key.Kid] = pubKey
			}
		}
	}

	v.keys = newKeys
	v.keysFetchedAt = time.Now()
	v.lastRefreshErr = nil
	return nil
}

func parseRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	var eInt int
	for _, b := range eBytes {
		eInt = (eInt << 8) | int(b)
	}

	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: eInt,
	}, nil
}

func parseMapClaims(m jwt.MapClaims) (*Claims, error) {
	c := &Claims{}

	if iss, ok := m["iss"].(string); ok {
		c.Issuer = iss
	}
	if sub, ok := m["sub"].(string); ok {
		c.Subject = sub
	}
	if email, ok := m["email"].(string); ok {
		c.Email = email
	}
	if name, ok := m["name"].(string); ok {
		c.FullName = name
	}

	if aud, ok := m["aud"].(string); ok {
		c.Audience = []string{aud}
	} else if audSlice, ok := m["aud"].([]interface{}); ok {
		for _, item := range audSlice {
			if s, ok := item.(string); ok {
				c.Audience = append(c.Audience, s)
			}
		}
	}

	if exp, ok := m["exp"].(float64); ok {
		c.ExpiresAt = int64(exp)
	}
	if nbf, ok := m["nbf"].(float64); ok {
		c.NotBefore = int64(nbf)
	}
	if iat, ok := m["iat"].(float64); ok {
		c.IssuedAt = int64(iat)
	}

	return c, nil
}
