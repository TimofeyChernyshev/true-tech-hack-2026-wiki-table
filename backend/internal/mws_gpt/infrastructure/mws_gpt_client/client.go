package mwsgptclient

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/mws_gpt/domain"

	"github.com/go-resty/resty/v2"
)

type ClientWrapper struct {
	genClient  *ClientWithResponses
	httpClient *resty.Client
	baseURL    string
	apiKey     string
}

func NewClientWrapper(baseURL, APIKey string, requestTimeout time.Duration) (*ClientWrapper, error) {
	httpClient := resty.New().
		SetBaseURL(baseURL).
		SetTimeout(requestTimeout).
		SetAuthScheme("Bearer").
		SetAuthToken(APIKey).
		SetHeader("Content-Type", "application/json").
		SetRetryCount(2).
		SetRetryWaitTime(1 * time.Second).
		SetRetryMaxWaitTime(5 * time.Second).
		OnAfterResponse(func(_ *resty.Client, r *resty.Response) error {
			if r.IsError() {
				slog.Error("MWS GPT HTTP error", "status", r.Status(), "body", string(r.Body()))
				return fmt.Errorf("http error: status=%s, body=%s", r.Status(), string(r.Body()))
			}
			return nil
		})

	genClient, err := NewClientWithResponses(baseURL, WithHTTPClient(httpClient.GetClient()))
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}

	return &ClientWrapper{
		genClient:  genClient,
		httpClient: httpClient,
		baseURL:    baseURL,
		apiKey:     APIKey,
	}, nil
}

// Ping проверяет доступность API
func (c *ClientWrapper) Ping(ctx context.Context) error {
	resp, err := c.genClient.GetModelsWithResponse(ctx)
	if err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}

	if resp.StatusCode() == 200 || resp.StatusCode() == 401 {
		return nil
	}

	return fmt.Errorf("unexpected status: %d", resp.StatusCode())
}

// GetModels возвращает список доступных моделей
func (c *ClientWrapper) GetModels(ctx context.Context) ([]Model, error) {
	resp, err := c.genClient.GetModelsWithResponse(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status: %d, body: %s", resp.StatusCode(), string(resp.Body))
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON200.Data, nil
}

// Chat отправляет сообщение в чат
func (c *ClientWrapper) Chat(ctx context.Context, req domain.ChatRequest) (*ChatCompletionResponse, error) {
	body := ChatCompletionRequest{
		Model:       req.Model,
		Messages:    make([]ChatMessage, len(req.Messages)),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}

	for i, m := range req.Messages {
		body.Messages[i] = ChatMessage{
			Content: m.Content,
			Role:    ChatMessageRole(m.Role),
		}
	}

	resp, err := c.genClient.PostChatCompletionsWithResponse(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("failed to chat: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, c.parseErrorResponse(resp.Body, resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON200, nil
}

// GenerateRequest параметры для генерации текста
type GenerateRequest struct {
	Model            string   `json:"model"`
	Prompt           string   `json:"prompt"`
	MaxTokens        *int     `json:"max_tokens,omitempty"`
	Temperature      *float32 `json:"temperature,omitempty"`
	TopP             *float32 `json:"top_p,omitempty"`
	Stop             []string `json:"stop,omitempty"`
	FrequencyPenalty *float32 `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float32 `json:"presence_penalty,omitempty"`
}

// Generate генерирует текст
func (c *ClientWrapper) Generate(ctx context.Context, req GenerateRequest) (*CompletionResponse, error) {
	body := CompletionRequest{
		Model:            req.Model,
		Prompt:           req.Prompt,
		MaxTokens:        req.MaxTokens,
		Temperature:      req.Temperature,
		TopP:             req.TopP,
		Stop:             &req.Stop,
		FrequencyPenalty: req.FrequencyPenalty,
		PresencePenalty:  req.PresencePenalty,
	}

	resp, err := c.genClient.PostCompletionsWithResponse(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("failed to generate: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, c.parseErrorResponse(resp.Body, resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON200, nil
}

// GetEmbeddings получает векторное представление текста
func (c *ClientWrapper) GetEmbeddings(ctx context.Context, model, input string) (*EmbeddingsResponse, error) {
	body := EmbeddingsRequest{
		Model: model,
		Input: input,
	}

	resp, err := c.genClient.PostEmbeddingsWithResponse(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("failed to get embeddings: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, c.parseErrorResponse(resp.Body, resp.StatusCode())
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("empty response")
	}

	return resp.JSON200, nil
}

// parseErrorResponse парсит ответ с ошибкой
func (c *ClientWrapper) parseErrorResponse(body []byte, statusCode int) error {
	var errResp ErrorResponse
	if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != nil {
		return fmt.Errorf("API error (status=%d): %s", statusCode, *errResp.Error.Message)
	}
	return fmt.Errorf("unexpected status: %d, body: %s", statusCode, string(body))
}
