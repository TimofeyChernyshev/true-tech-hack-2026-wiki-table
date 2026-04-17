package application

import (
	"context"
	"fmt"
	"log/slog"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	FindByID(ctx context.Context, id string) (*domain.User, error)
	FindAll(ctx context.Context) ([]*domain.User, error)
	UpdateRole(ctx context.Context, userID string, role domain.Role) error
}

type TokenManager interface {
	GenerateTokenPair(user *domain.User) (*domain.TokenPair, error)
	ValidateToken(token string) (*domain.TokenClaims, error)
	RefreshToken(refreshToken string) (*domain.TokenPair, error)
	RevokeToken(token string) error
}

type AuthService struct {
	userRepo UserRepository
	tokenMgr TokenManager
}

func NewAuthService(userRepo UserRepository, tokenMgr TokenManager) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		tokenMgr: tokenMgr,
	}
}

// Register регистрирует нового пользователя
func (s *AuthService) Register(ctx context.Context, email, password, name string) (*domain.User, *domain.TokenPair, error) {
	existing, err := s.userRepo.FindByEmail(ctx, email)
	if err == nil && existing != nil {
		return nil, nil, fmt.Errorf("user already exists")
	}

	user, err := domain.NewUser(email, password, name)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create user: %w", err)
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, nil, fmt.Errorf("failed to save user: %w", err)
	}

	tokens, err := s.tokenMgr.GenerateTokenPair(user)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	slog.Info("User registered", "email", email, "role", user.Role)

	return user, tokens, nil
}

// Login выполняет вход пользователя
func (s *AuthService) Login(ctx context.Context, email, password string) (*domain.User, *domain.TokenPair, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	if !user.CheckPassword(password) {
		return nil, nil, fmt.Errorf("invalid credentials")
	}

	tokens, err := s.tokenMgr.GenerateTokenPair(user)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	slog.Info("User logged in", "email", email)

	return user, tokens, nil
}

// Logout выполняет выход пользователя
func (s *AuthService) Logout(ctx context.Context, token string) error {
	return s.tokenMgr.RevokeToken(token)
}

// Refresh обновляет токены
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*domain.TokenPair, error) {
	return s.tokenMgr.RefreshToken(refreshToken)
}

// GetMe возвращает информацию о текущем пользователе
func (s *AuthService) GetMe(ctx context.Context, userID string) (*domain.User, error) {
	return s.userRepo.FindByID(ctx, userID)
}

// ListUsers возвращает список пользователей (только для admin)
func (s *AuthService) ListUsers(ctx context.Context) ([]*domain.User, error) {
	return s.userRepo.FindAll(ctx)
}

// UpdateUserRole изменяет роль пользователя (только для admin)
func (s *AuthService) UpdateUserRole(ctx context.Context, userID string, role domain.Role) error {
	return s.userRepo.UpdateRole(ctx, userID, role)
}

// CheckPermission проверяет права доступа
func (s *AuthService) CheckPermission(ctx context.Context, userID, resource, action string) (bool, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return false, nil
	}

	switch resource {
	case "document", "table":
		switch action {
		case "read":
			return user.CanRead(), nil
		case "write":
			return user.CanWrite(), nil
		case "delete":
			return user.CanDelete(), nil
		}
	case "field":
		switch action {
		case "write", "delete":
			return user.CanEditFields(), nil
		}
	case "user":
		switch action {
		case "write", "delete":
			return user.CanManageUsers(), nil
		}
	}

	return false, nil
}

func (s *AuthService) ValidateToken(ctx context.Context, token string) (*domain.TokenClaims, error) {
	return s.tokenMgr.ValidateToken(token)
}
