package repository

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/domain"
)

type InMemoryUserRepository struct {
	users map[string]*domain.User
	mu    sync.RWMutex
}

func NewInMemoryUserRepository() *InMemoryUserRepository {
	return &InMemoryUserRepository{
		users: make(map[string]*domain.User),
	}
}

func (r *InMemoryUserRepository) Create(ctx context.Context, user *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Проверяем email
	for _, u := range r.users {
		if u.Email == user.Email {
			return fmt.Errorf("user already exists")
		}
	}

	r.users[user.ID] = user
	return nil
}

func (r *InMemoryUserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, u := range r.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (r *InMemoryUserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if u, ok := r.users[id]; ok {
		return u, nil
	}
	return nil, sql.ErrNoRows
}

func (r *InMemoryUserRepository) FindAll(ctx context.Context) ([]*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	users := make([]*domain.User, 0, len(r.users))
	for _, u := range r.users {
		users = append(users, u)
	}
	return users, nil
}

func (r *InMemoryUserRepository) UpdateRole(ctx context.Context, userID string, role domain.Role) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if u, ok := r.users[userID]; ok {
		u.Role = role
		u.UpdatedAt = time.Now()
		return nil
	}
	return sql.ErrNoRows
}
