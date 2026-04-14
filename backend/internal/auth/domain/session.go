package domain

import "time"

// TokenPair содержит access и refresh токены
type TokenPair struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"-"`
}

// TokenClaims содержит данные токена
type TokenClaims struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Role   Role   `json:"role"`
}
