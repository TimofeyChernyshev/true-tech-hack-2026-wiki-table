package mwsgpthttp

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/domain"

	"github.com/gin-gonic/gin"
)

// PostGptChat отправляет сообщение в чат
func (s *Server) PostGptChat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.badRequest(c, "Invalid request body", err.Error())
		return
	}

	if len(req.Messages) == 0 {
		s.badRequest(c, "Messages cannot be empty", "")
		return
	}

	serviceReq := domain.ChatRequest{
		Messages: make([]domain.Message, len(req.Messages)),
	}

	for i, m := range req.Messages {
		serviceReq.Messages[i] = domain.Message{
			Content: m.Content,
			Role:    domain.MessageRole(m.Role),
		}
	}

	if req.Model != nil {
		serviceReq.Model = *req.Model
	}
	if req.Temperature != nil {
		serviceReq.Temperature = req.Temperature
	}
	if req.MaxTokens != nil {
		serviceReq.MaxTokens = req.MaxTokens
	}
	if req.SystemPrompt != nil {
		serviceReq.SystemPrompt = req.SystemPrompt
	}

	resp, err := s.gptService.Chat(c.Request.Context(), serviceReq)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ChatResponse{
		Id: &resp.ID,
		Message: Message{
			Content: resp.Message.Content,
			Role:    MessageRole(resp.Message.Role),
		},
		Model: &resp.Model,
		Usage: TokenUsage{
			CompletionTokens: resp.Usage.CompletionTokens,
			PromptTokens:     resp.Usage.PromptTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	})
}

// PostGptChatStream отправляет сообщение в чат с потоковой передачей
func (s *Server) PostGptChatStream(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.badRequest(c, "Invalid request body", err.Error())
		return
	}

	if len(req.Messages) == 0 {
		s.badRequest(c, "Messages cannot be empty", "")
		return
	}

	serviceReq := domain.ChatRequest{
		Messages: make([]domain.Message, len(req.Messages)),
	}

	for i, m := range req.Messages {
		serviceReq.Messages[i] = domain.Message{
			Content: m.Content,
			Role:    domain.MessageRole(m.Role),
		}
	}

	if req.Model != nil {
		serviceReq.Model = *req.Model
	}
	if req.Temperature != nil {
		serviceReq.Temperature = req.Temperature
	}
	if req.MaxTokens != nil {
		serviceReq.MaxTokens = req.MaxTokens
	}
	if req.SystemPrompt != nil {
		serviceReq.SystemPrompt = req.SystemPrompt
	}

	stream, err := s.gptService.ChatStream(c.Request.Context(), serviceReq)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	c.Stream(func(w io.Writer) bool {
		for chunk := range stream {
			fmt.Fprintf(w, "data: %s\n\n", chunk)
			c.Writer.Flush()
		}
		return false
	})
}

// PostGptGenerate генерирует текст
func (s *Server) PostGptGenerate(c *gin.Context) {
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.badRequest(c, "Invalid request body", err.Error())
		return
	}

	if req.Prompt == "" {
		s.badRequest(c, "Prompt cannot be empty", "")
		return
	}

	serviceReq := domain.GenerateRequest{
		Prompt: req.Prompt,
	}

	if req.Model != nil {
		serviceReq.Model = *req.Model
	}
	if req.Temperature != nil {
		serviceReq.Temperature = req.Temperature
	}
	if req.MaxTokens != nil {
		serviceReq.MaxTokens = req.MaxTokens
	}
	if req.StopSequences != nil {
		serviceReq.StopSequences = *req.StopSequences
	}

	resp, err := s.gptService.Generate(c.Request.Context(), serviceReq)
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, GenerateResponse{
		Id:    &resp.ID,
		Text:  resp.Text,
		Model: &resp.Model,
		Usage: TokenUsage{
			CompletionTokens: resp.Usage.CompletionTokens,
			PromptTokens:     resp.Usage.PromptTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	})
}

// PostGptEmbeddings получает эмбеддинги
func (s *Server) PostGptEmbeddings(c *gin.Context) {
	var req EmbeddingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.badRequest(c, "Invalid request body", err.Error())
		return
	}

	var input []string

	// Обработка union типа (строка или массив строк)
	if str, err := req.Input.AsEmbeddingsRequestInput0(); err == nil {
		input = []string{str}
	} else if arr, err := req.Input.AsEmbeddingsRequestInput1(); err == nil {
		input = arr
	} else {
		s.badRequest(c, "Input must be string or array of strings", "")
		return
	}

	if len(input) == 0 {
		s.badRequest(c, "Input cannot be empty", "")
		return
	}

	serviceReq := domain.EmbeddingsRequest{
		Input: input,
	}

	if req.Model != nil {
		serviceReq.Model = *req.Model
	}

	resp, err := s.gptService.GetEmbeddings(c.Request.Context(), serviceReq)
	if err != nil {
		s.handleError(c, err)
		return
	}

	embeddings := make([]EmbeddingData, len(resp.Embeddings))
	for i, emb := range resp.Embeddings {
		embeddings[i] = EmbeddingData{
			Index:     i,
			Embedding: emb,
		}
	}

	c.JSON(http.StatusOK, EmbeddingsResponse{
		Embeddings: embeddings,
		Model:      &resp.Model,
		Usage: TokenUsage{
			CompletionTokens: resp.Usage.CompletionTokens,
			PromptTokens:     resp.Usage.PromptTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	})
}

// GetGptModels возвращает список моделей
func (s *Server) GetGptModels(c *gin.Context) {
	models, err := s.gptService.GetModels(c.Request.Context())
	if err != nil {
		s.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ModelsResponse{
		Models: models,
	})
}

func (s *Server) badRequest(c *gin.Context, message, details string) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error: struct {
			Code    ErrorResponseErrorCode `json:"code"`
			Details *string                `json:"details,omitempty"`
			Message string                 `json:"message"`
		}{
			Code:    BADREQUEST,
			Message: message,
			Details: &details,
		},
	})
}

func (s *Server) handleError(c *gin.Context, err error) {
	slog.Error("Request failed", "error", err)

	code := INTERNALERROR
	message := "Internal server error"
	status := http.StatusInternalServerError

	errStr := err.Error()

	switch {
	case errors.Is(err, context.DeadlineExceeded):
		code = INTERNALERROR
		message = "Request timeout"
		status = http.StatusGatewayTimeout
	case strings.Contains(errStr, "not found") || strings.Contains(errStr, "model"):
		code = NOTFOUND
		message = "Model not found"
		status = http.StatusNotFound
	case strings.Contains(errStr, "rate limit"):
		code = RATELIMITED
		message = "Rate limited"
		status = http.StatusTooManyRequests
	case strings.Contains(errStr, "unauthorized") || strings.Contains(errStr, "invalid api key"):
		code = UNAUTHORIZED
		message = "Invalid API key"
		status = http.StatusUnauthorized
	}

	c.JSON(status, ErrorResponse{
		Error: struct {
			Code    ErrorResponseErrorCode `json:"code"`
			Details *string                `json:"details,omitempty"`
			Message string                 `json:"message"`
		}{
			Code:    code,
			Message: message,
			Details: &errStr,
		},
	})
}
