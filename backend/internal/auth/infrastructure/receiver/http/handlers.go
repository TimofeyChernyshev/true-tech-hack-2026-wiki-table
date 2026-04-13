package authhttp

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/auth/domain"

	"github.com/gin-gonic/gin"
)

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Unix(),
	})
}

// PostAuthRegister регистрация нового пользователя
// (POST /auth/register)
func (s *Server) PostAuthRegister(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    ptr(400),
			Message: ptr("Invalid request body"),
			Details: ptr(err.Error()),
		})
		return
	}

	user, tokens, err := s.authService.Register(
		c.Request.Context(),
		string(req.Email),
		req.Password,
		req.Name,
	)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, ErrorResponse{
				Code:    ptr(409),
				Message: ptr("User already exists"),
			})
			return
		}
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		AccessToken:  &tokens.AccessToken,
		RefreshToken: &tokens.RefreshToken,
		User:         domainUserToResponse(user),
	})
}

// PostAuthLogin вход в систему
// (POST /auth/login)
func (s *Server) PostAuthLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    ptr(400),
			Message: ptr("Invalid request body"),
			Details: ptr(err.Error()),
		})
		return
	}

	user, tokens, err := s.authService.Login(
		c.Request.Context(),
		string(req.Email),
		req.Password,
	)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    ptr(401),
			Message: ptr("Invalid credentials"),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		AccessToken:  &tokens.AccessToken,
		RefreshToken: &tokens.RefreshToken,
		User:         domainUserToResponse(user),
	})
}

// PostAuthLogout выход из системы
// (POST /auth/logout)
func (s *Server) PostAuthLogout(c *gin.Context) {
	token := s.extractToken(c)
	if token == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    ptr(401),
			Message: ptr("Missing authorization token"),
		})
		return
	}

	if err := s.authService.Logout(c.Request.Context(), token); err != nil {
		s.handleError(c, err)
		return
	}

	success := true
	message := "Successfully logged out"
	c.JSON(http.StatusOK, SuccessResponse{
		Success: &success,
		Message: &message,
	})
}

// GetAuthMe получить информацию о текущем пользователе
// (GET /auth/me)
func (s *Server) GetAuthMe(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    ptr(401),
			Message: ptr("Unauthorized"),
		})
		return
	}

	user, err := s.authService.GetMe(c.Request.Context(), userID)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, domainUserToResponse(user))
}

// PostAuthRefresh обновление токена
// (POST /auth/refresh)
func (s *Server) PostAuthRefresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    ptr(400),
			Message: ptr("Invalid request body"),
			Details: ptr(err.Error()),
		})
		return
	}

	tokens, err := s.authService.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    ptr(401),
			Message: ptr("Invalid refresh token"),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		AccessToken:  &tokens.AccessToken,
		RefreshToken: &tokens.RefreshToken,
	})
}

// PostAuthCheckPermission проверить права доступа
// (POST /auth/check-permission)
func (s *Server) PostAuthCheckPermission(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    ptr(401),
			Message: ptr("Unauthorized"),
		})
		return
	}

	var req CheckPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    ptr(400),
			Message: ptr("Invalid request body"),
			Details: ptr(err.Error()),
		})
		return
	}

	allowed, err := s.authService.CheckPermission(
		c.Request.Context(),
		userID,
		string(req.Resource),
		string(req.Action),
	)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, PermissionResponse{
		Allowed: &allowed,
	})
}

// GetUsers список пользователей (только для admin)
// (GET /users)
func (s *Server) GetUsers(c *gin.Context) {
	users, err := s.authService.ListUsers(c.Request.Context())
	if err != nil {
		s.handleError(c, err)
		return
	}

	response := make([]UserResponse, len(users))
	for i, u := range users {
		response[i] = *domainUserToResponse(u)
	}

	c.JSON(http.StatusOK, response)
}

// PatchUsersUserIdRole изменить роль пользователя
// (PATCH /users/{userId}/role)
func (s *Server) PatchUsersUserIdRole(c *gin.Context, userId string) {
	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    ptr(400),
			Message: ptr("Invalid request body"),
			Details: ptr(err.Error()),
		})
		return
	}

	role := domain.Role(req.Role)
	if err := s.authService.UpdateUserRole(c.Request.Context(), userId, role); err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AuthMiddleware проверяет JWT токен
func (s *Server) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := s.extractToken(c)
		if token == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Code:    ptr(401),
				Message: ptr("Missing authorization token"),
			})
			c.Abort()
			return
		}

		claims, err := s.authService.ValidateToken(c.Request.Context(), token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Code:    ptr(401),
				Message: ptr("Invalid token"),
			})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", string(claims.Role))

		c.Next()
	}
}

// AdminMiddleware проверяет роль admin
func (s *Server) AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("userRole")
		if role != string(domain.RoleAdmin) {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Code:    ptr(403),
				Message: ptr("Admin access required"),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func (s *Server) extractToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}

	return parts[1]
}

func (s *Server) handleError(c *gin.Context, err error) {
	slog.Error("Request failed", "error", err)

	status := http.StatusInternalServerError
	message := "Internal server error"

	switch {
	case errors.Is(err, context.DeadlineExceeded):
		status = http.StatusGatewayTimeout
		message = "Request timeout"
	case strings.Contains(err.Error(), "not found"):
		status = http.StatusNotFound
		message = "Resource not found"
	case strings.Contains(err.Error(), "invalid"):
		status = http.StatusBadRequest
		message = "Invalid request"
	}

	c.JSON(status, ErrorResponse{
		Code:    ptr(status),
		Message: ptr(message),
	})
}

func domainUserToResponse(u *domain.User) *UserResponse {
	role := UserResponseRole(u.Role)
	return &UserResponse{
		Id:        &u.ID,
		Email:     &u.Email,
		Name:      &u.Name,
		Role:      &role,
		CreatedAt: &u.CreatedAt,
	}
}

func ptr[T any](v T) *T {
	return &v
}
