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

// GetModels возвращает список доступных моделей
func (c *ClientWrapper) GetModels(ctx context.Context) ([]domain.Model, error) {
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

	models := make([]domain.Model, len(resp.JSON200.Data))
	for i, m := range resp.JSON200.Data {
		models[i] = domain.Model{
			Created: m.Created,
			Id:      m.Id,
			Object:  domain.ModelObject(m.Object),
			OwnedBy: m.OwnedBy,
		}
	}

	return models, nil
}

// Chat отправляет сообщение в чат
func (c *ClientWrapper) Chat(ctx context.Context, req domain.ChatRequest) (*domain.ChatResponse, error) {
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

	if resp.JSON200.Choices == nil || len(*resp.JSON200.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice := (*resp.JSON200.Choices)[0]
	if choice.Message == nil {
		return nil, fmt.Errorf("no message in choice")
	}

	return &domain.ChatResponse{
		ID: *resp.JSON200.Id,
		Message: domain.Message{
			Role:    domain.MessageRole(choice.Message.Role),
			Content: choice.Message.Content,
		},
		Model: *resp.JSON200.Model,
		Usage: domain.TokenUsage{
			CompletionTokens: *resp.JSON200.Usage.CompletionTokens,
			PromptTokens:     *resp.JSON200.Usage.PromptTokens,
			TotalTokens:      *resp.JSON200.Usage.TotalTokens,
		},
	}, nil
}

// Generate генерирует текст
func (c *ClientWrapper) Generate(ctx context.Context, req domain.GenerateRequest) (*domain.GenerateResponse, error) {
	body := CompletionRequest{
		Model:            req.Model,
		Prompt:           req.Prompt,
		MaxTokens:        req.MaxTokens,
		Temperature:      req.Temperature,
		Stop:             &req.StopSequences,
		TopP:             nil,
		FrequencyPenalty: nil,
		PresencePenalty:  nil,
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

	if resp.JSON200.Choices == nil || len(*resp.JSON200.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	choice := (*resp.JSON200.Choices)[0]
	if choice.Text == nil {
		return nil, fmt.Errorf("no text in choice")
	}

	return &domain.GenerateResponse{
		ID:    *resp.JSON200.Id,
		Text:  *choice.Text,
		Model: *resp.JSON200.Model,
		Usage: domain.TokenUsage{
			CompletionTokens: *resp.JSON200.Usage.CompletionTokens,
			PromptTokens:     *resp.JSON200.Usage.PromptTokens,
			TotalTokens:      *resp.JSON200.Usage.TotalTokens,
		},
	}, nil
}

// GetEmbeddings получает векторное представление текста
func (c *ClientWrapper) GetEmbeddings(ctx context.Context, req domain.EmbeddingsRequest) (*domain.EmbeddingsResponse, error) {
	embeddings := make([][]float32, len(req.Input))
	var totalTokens int

	for i, input := range req.Input {
		body := EmbeddingsRequest{
			Model: req.Model,
			Input: input,
		}

		resp, err := c.genClient.PostEmbeddingsWithResponse(ctx, body)
		if err != nil {
			return nil, fmt.Errorf("embeddings failed for input %d: %w", i, err)
		}

		if resp.StatusCode() != 200 {
			return nil, c.parseErrorResponse(resp.Body, resp.StatusCode())
		}

		if resp.JSON200 == nil {
			return nil, fmt.Errorf("empty response for input %d", i)
		}

		if resp.JSON200.Data != nil && len(*resp.JSON200.Data) > 0 {
			data := (*resp.JSON200.Data)[0]
			if data.Embedding != nil {
				embeddings[i] = *data.Embedding
			}
		}

		if resp.JSON200.Usage != nil && resp.JSON200.Usage.TotalTokens != nil {
			totalTokens += *resp.JSON200.Usage.TotalTokens
		}
	}

	return &domain.EmbeddingsResponse{
		Embeddings: embeddings,
		Model:      req.Model,
		Usage: domain.TokenUsage{
			TotalTokens: totalTokens,
		},
	}, nil
}

// parseErrorResponse парсит ответ с ошибкой
func (c *ClientWrapper) parseErrorResponse(body []byte, statusCode int) error {
	var errResp ErrorResponse
	if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != nil {
		return fmt.Errorf("API error (status=%d): %s", statusCode, *errResp.Error.Message)
	}
	return fmt.Errorf("unexpected status: %d, body: %s", statusCode, string(body))
}
