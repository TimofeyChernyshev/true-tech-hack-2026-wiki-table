package postgresrepository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/domain"

	_ "github.com/lib/pq"
)

type PostgresUserRepository struct {
	db *sql.DB
}

func NewPostgresUserRepository(connString string) (*PostgresUserRepository, error) {
	db, err := sql.Open("postgres", connString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return &PostgresUserRepository{db: db}, nil
}

func (r *PostgresUserRepository) Close() error {
	return r.db.Close()
}

// Create создает нового пользователя
func (r *PostgresUserRepository) Create(ctx context.Context, user *domain.User) error {
	query := `
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `

	_, err := r.db.ExecContext(ctx, query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Name,
		string(user.Role),
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		if isDuplicateKeyError(err) {
			return fmt.Errorf("user already exists")
		}
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// FindByEmail находит пользователя по email
func (r *PostgresUserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
        SELECT id, email, password_hash, name, role, created_at, updated_at
        FROM users
        WHERE email = $1
    `

	row := r.db.QueryRowContext(ctx, query, email)

	var user domain.User
	var roleStr string

	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&roleStr,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	user.Role = domain.Role(roleStr)

	return &user, nil
}

// FindByID находит пользователя по ID
func (r *PostgresUserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
        SELECT id, email, password_hash, name, role, created_at, updated_at
        FROM users
        WHERE id = $1
    `

	row := r.db.QueryRowContext(ctx, query, id)

	var user domain.User
	var roleStr string

	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&roleStr,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	user.Role = domain.Role(roleStr)

	return &user, nil
}

// FindAll возвращает всех пользователей
func (r *PostgresUserRepository) FindAll(ctx context.Context) ([]*domain.User, error) {
	query := `
        SELECT id, email, password_hash, name, role, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
    `

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		var user domain.User
		var roleStr string

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Name,
			&roleStr,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}

		user.Role = domain.Role(roleStr)
		users = append(users, &user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return users, nil
}

// UpdateRole обновляет роль пользователя
func (r *PostgresUserRepository) UpdateRole(ctx context.Context, userID string, role domain.Role) error {
	query := `
        UPDATE users
        SET role = $1, updated_at = $2
        WHERE id = $3
    `

	result, err := r.db.ExecContext(ctx, query, string(role), time.Now(), userID)
	if err != nil {
		return fmt.Errorf("failed to update role: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := err.Error()
	return strings.Contains(errMsg, "duplicate key") ||
		strings.Contains(errMsg, "UNIQUE constraint failed") ||
		strings.Contains(errMsg, "23505")
}
