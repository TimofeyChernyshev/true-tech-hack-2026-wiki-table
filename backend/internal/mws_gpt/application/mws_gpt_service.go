package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/domain"
)

type GPTClient interface {
	GetModels(ctx context.Context) ([]domain.Model, error)
	Chat(ctx context.Context, req domain.ChatRequest) (*domain.ChatResponse, error)
	Generate(ctx context.Context, req domain.GenerateRequest) (*domain.GenerateResponse, error)
	GetEmbeddings(ctx context.Context, req domain.EmbeddingsRequest) (*domain.EmbeddingsResponse, error)
}

type GPTService struct {
	client GPTClient
}

func NewGPTService(client GPTClient) *GPTService {
	return &GPTService{
		client: client,
	}
}

// GetModels возвращает список доступных моделей
func (s *GPTService) GetModels(ctx context.Context) ([]domain.Model, error) {
	models, err := s.client.GetModels(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	slog.Debug("Got models", "count", len(models))

	return models, nil
}

// Chat отправляет сообщение в чат
func (s *GPTService) Chat(ctx context.Context, req domain.ChatRequest) (*domain.ChatResponse, error) {
	if req.Model == "" {
		return nil, errors.New("model is not provided")
	}

	slog.Debug("Sending chat request",
		"model", req.Model,
		"messages", len(req.Messages),
		"temperature", req.Temperature,
		"maxTokens", req.MaxTokens)

	resp, err := s.client.Chat(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("chat failed: %w", err)
	}

	slog.Debug("Chat response received",
		"tokens", resp.Usage.TotalTokens)

	return resp, nil
}

// ChatStream отправляет сообщение в чат с потоковой передачей
func (s *GPTService) ChatStream(ctx context.Context, req domain.ChatRequest) (<-chan string, error) {
	ch := make(chan string)

	go func() {
		defer close(ch)

		resp, err := s.Chat(ctx, req)
		if err != nil {
			ch <- fmt.Sprintf("error: %v", err)
			return
		}

		// Эмуляция потоковой передачи - разбиваем на слова
		words := strings.Fields(resp.Message.Content)
		for _, word := range words {
			select {
			case <-ctx.Done():
				return
			case ch <- word + " ":
			}
		}
	}()

	return ch, nil
}

// Generate генерирует текст
func (s *GPTService) Generate(ctx context.Context, req domain.GenerateRequest) (*domain.GenerateResponse, error) {
	if req.Model == "" {
		return nil, errors.New("model is not provided")
	}

	slog.Debug("Sending generate request",
		"model", req.Model,
		"prompt", truncate(req.Prompt, 50),
		"maxTokens", req.MaxTokens)

	resp, err := s.client.Generate(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("generate failed: %w", err)
	}

	slog.Debug("Generate response received",
		"tokens", resp.Usage.TotalTokens,
		"length", len(resp.Text))

	return resp, nil
}

// GetEmbeddings получает векторное представление текста
func (s *GPTService) GetEmbeddings(ctx context.Context, req domain.EmbeddingsRequest) (*domain.EmbeddingsResponse, error) {
	if req.Model == "" {
		return nil, errors.New("model is not provided")
	}

	slog.Debug("Getting embeddings",
		"model", req.Model,
		"inputs", len(req.Input))

	resp, err := s.client.GetEmbeddings(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("embeddings failed: %w", err)
	}

	slog.Debug("Embeddings received",
		"vectors", len(resp.Embeddings),
		"tokens", resp.Usage.TotalTokens)

	return resp, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
