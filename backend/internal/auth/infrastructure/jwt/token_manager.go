package jwt

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/domain"

	"github.com/golang-jwt/jwt/v5"
)

type TokenManager struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
	revokedTokens sync.Map
}

func NewTokenManager(accessSecret, refreshSecret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		accessSecret:  []byte(accessSecret),
		refreshSecret: []byte(refreshSecret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

func (m *TokenManager) GenerateTokenPair(user *domain.User) (*domain.TokenPair, error) {
	accessToken, err := m.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := m.generateRefreshToken()
	if err != nil {
		return nil, err
	}

	return &domain.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().Add(m.accessTTL),
	}, nil
}

func (m *TokenManager) generateAccessToken(user *domain.User) (string, error) {
	claims := jwt.MapClaims{
		"userId": user.ID,
		"email":  user.Email,
		"role":   string(user.Role),
		"exp":    time.Now().Add(m.accessTTL).Unix(),
		"iat":    time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.accessSecret)
}

func (m *TokenManager) generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b), nil
}

func (m *TokenManager) ValidateToken(tokenString string) (*domain.TokenClaims, error) {
	if _, revoked := m.revokedTokens.Load(tokenString); revoked {
		return nil, fmt.Errorf("token revoked")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return m.accessSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return &domain.TokenClaims{
			UserID: claims["userId"].(string),
			Email:  claims["email"].(string),
			Role:   domain.Role(claims["role"].(string)),
		}, nil
	}

	return nil, fmt.Errorf("invalid token")
}

func (m *TokenManager) RefreshToken(refreshToken string) (*domain.TokenPair, error) {
	// TODO: хранить refresh токены в БД и проверять
	return nil, fmt.Errorf("not implemented")
}

func (m *TokenManager) RevokeToken(token string) error {
	m.revokedTokens.Store(token, true)
	return nil
}
