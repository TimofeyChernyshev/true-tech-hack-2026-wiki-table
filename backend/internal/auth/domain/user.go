package domain

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         Role      `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// NewUser создает нового пользователя
func NewUser(email, password, name string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	return &User{
		ID:           generateID(),
		Email:        email,
		PasswordHash: string(hash),
		Name:         name,
		Role:         RoleReader,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

func (u *User) CanRead() bool {
	return true // все роли могут читать
}

func (u *User) CanWrite() bool {
	return u.Role == RoleEditor || u.Role == RoleAdmin
}

func (u *User) CanDelete() bool {
	return u.Role == RoleEditor || u.Role == RoleAdmin
}

// CanManageUsers проверяет право на управление пользователями
func (u *User) CanManageUsers() bool {
	return u.Role == RoleAdmin
}

// CanEditFields проверяет право на редактирование полей таблицы
func (u *User) CanEditFields() bool {
	return u.Role == RoleEditor || u.Role == RoleAdmin
}

func generateID() string {
	return "usr_" + randomString(16)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}
