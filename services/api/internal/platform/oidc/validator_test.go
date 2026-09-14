package oidc

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidatorTokenVerification(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	issuer := "http://localhost:8081/realms/finintel"
	audience := "finintel-api"
	kid := "test-key-1"

	v := NewValidator(ValidatorConfig{
		IssuerURL: issuer,
		Audience:  audience,
	})
	v.SetPublicKey(kid, &privateKey.PublicKey)

	t.Run("Valid Token", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss":   issuer,
			"aud":   audience,
			"sub":   "user-123",
			"email": "user@example.com",
			"name":  "Test User",
			"exp":   time.Now().Add(1 * time.Hour).Unix(),
			"iat":   time.Now().Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		claims, err := v.ValidateToken(signedToken)
		require.NoError(t, err)
		assert.Equal(t, "user-123", claims.Subject)
		assert.Equal(t, "user@example.com", claims.Email)
		assert.Equal(t, "Test User", claims.FullName)
	})

	t.Run("Expired Token", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": issuer,
			"aud": audience,
			"sub": "user-123",
			"exp": time.Now().Add(-2 * time.Hour).Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "token is expired")
	})

	t.Run("Issuer Mismatch", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": "http://untrusted-issuer.com",
			"aud": audience,
			"sub": "user-123",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "issuer mismatch")
	})

	t.Run("Audience Mismatch", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": issuer,
			"aud": "wrong-audience",
			"sub": "user-123",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "audience mismatch")
	})

	t.Run("Missing Expiration (exp)", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": issuer,
			"aud": audience,
			"sub": "user-123",
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exp")
	})

	t.Run("Missing Subject (sub)", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": issuer,
			"aud": audience,
			"sub": "",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "sub")
	})

	t.Run("Future NotBefore (nbf)", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": issuer,
			"aud": audience,
			"sub": "user-123",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
			"nbf": time.Now().Add(30 * time.Minute).Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "token is not valid yet")
	})

	t.Run("Wrong Algorithm (HS256)", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"iss": issuer,
			"aud": audience,
			"sub": "user-123",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		token.Header["kid"] = kid

		signedToken, err := token.SignedString([]byte("secret"))
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "signing method HS256 is invalid")
	})

	t.Run("Unknown kid", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": issuer,
			"aud": audience,
			"sub": "user-123",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		token.Header["kid"] = "unknown-nonexistent-kid"

		signedToken, err := token.SignedString(privateKey)
		require.NoError(t, err)

		_, err = v.ValidateToken(signedToken)
		require.Error(t, err)
		assert.True(t, strings.Contains(err.Error(), "unknown kid") || strings.Contains(err.Error(), "failed to refresh JWKS"))
	})
}

func jwkFromRSAPublicKey(kid string, pub *rsa.PublicKey) map[string]interface{} {
	return map[string]interface{}{
		"kty": "RSA",
		"kid": kid,
		"use": "sig",
		"alg": "RS256",
		"n":   base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
		"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes()),
	}
}

func TestValidatorDynamicJWKSKeyRotation(t *testing.T) {
	// Generate initial RSA keypair
	key1, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	kid1 := "key-initial-20260901"

	var mu sync.RWMutex
	activeJWKS := map[string]interface{}{
		"keys": []interface{}{jwkFromRSAPublicKey(kid1, &key1.PublicKey)},
	}

	// Dynamic JWKS test HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(activeJWKS)
	}))
	defer server.Close()

	issuer := "https://auth.example.com"
	audience := "finintel-api"

	v := NewValidator(ValidatorConfig{
		IssuerURL:   issuer,
		Audience:    audience,
		JwksURL:     server.URL,
		HTTPTimeout: 5 * time.Second,
	})

	// 1. Validate token signed with initial key (fetches kid1 from server)
	token1 := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": issuer,
		"aud": audience,
		"sub": "user-before-rotation",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	})
	token1.Header["kid"] = kid1

	signed1, err := token1.SignedString(key1)
	require.NoError(t, err)

	claims1, err := v.ValidateToken(signed1)
	require.NoError(t, err)
	assert.Equal(t, "user-before-rotation", claims1.Subject)

	// 2. Perform genuine key rotation on the IdP HTTP server
	key2, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	kid2 := "key-rotated-20260914"

	mu.Lock()
	activeJWKS = map[string]interface{}{
		"keys": []interface{}{
			jwkFromRSAPublicKey(kid1, &key1.PublicKey),
			jwkFromRSAPublicKey(kid2, &key2.PublicKey),
		},
	}
	mu.Unlock()

	// Simulate passage of time for rate limit window
	v.mu.Lock()
	v.lastRefresh = time.Now().Add(-15 * time.Second)
	v.mu.Unlock()

	// 3. Validate token signed with newly rotated key2
	token2 := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": issuer,
		"aud": audience,
		"sub": "user-after-rotation",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	})
	token2.Header["kid"] = kid2

	signed2, err := token2.SignedString(key2)
	require.NoError(t, err)

	// Validator detects kid2 is not cached, fetches updated JWKS from server, and validates
	claims2, err := v.ValidateToken(signed2)
	require.NoError(t, err)
	assert.Equal(t, "user-after-rotation", claims2.Subject)
}

func TestValidatorHTTPSRedirectDowngradeRejection(t *testing.T) {
	// Plain HTTP target server
	httpTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"keys":[]}`))
	}))
	defer httpTarget.Close()

	// HTTPS redirecting server
	httpsServer := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, httpTarget.URL, http.StatusFound)
	}))
	defer httpsServer.Close()

	v := NewValidator(ValidatorConfig{
		IssuerURL:   "https://auth.example.com",
		Audience:    "finintel-api",
		JwksURL:     httpsServer.URL,
		HTTPTimeout: 5 * time.Second,
	})
	// Allow TLS test cert while retaining CheckRedirect logic
	v.httpClient.Transport = httpsServer.Client().Transport

	err := v.refreshKeysRateLimited()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "insecure redirect downgrade from https to http rejected")
}

func TestValidatorJWKSErrors(t *testing.T) {
	t.Run("JWKS Timeout or Unreachable", func(t *testing.T) {
		v := NewValidator(ValidatorConfig{
			IssuerURL:   "https://nonexistent.auth.example.com",
			Audience:    "finintel-api",
			JwksURL:     "http://127.0.0.1:59999/unreachable-jwks.json",
			HTTPTimeout: 100 * time.Millisecond,
		})

		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"iss": "https://nonexistent.auth.example.com",
			"aud": "finintel-api",
			"sub": "user-123",
			"exp": time.Now().Add(1 * time.Hour).Unix(),
		})
		token.Header["kid"] = "some-kid"

		key, err := rsa.GenerateKey(rand.Reader, 2048)
		require.NoError(t, err)
		signed, err := token.SignedString(key)
		require.NoError(t, err)

		_, err = v.ValidateToken(signed)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrInfraFailure), "Unreachable JWKS must return ErrInfraFailure")
	})
}
