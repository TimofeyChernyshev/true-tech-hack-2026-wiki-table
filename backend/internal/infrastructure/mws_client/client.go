package mwsclient

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

// normalizeFusionBaseURL убирает хвост /fusion/v1, если он указан в MWS_TABLES_BASE_URL.
// Сгенерированный клиент сам добавляет пути вида /fusion/v1/...; иначе получается
// .../fusion/v1/fusion/v1/... и MWS отвечает 404 «API не существует».
func normalizeFusionBaseURL(raw string) string {
	u := strings.TrimSpace(strings.TrimRight(raw, "/"))
	for {
		lower := strings.ToLower(u)
		if !strings.HasSuffix(lower, "/fusion/v1") {
			break
		}
		u = u[:len(u)-len("/fusion/v1")]
		u = strings.TrimRight(u, "/")
	}
	return u
}

// authorizationHeaderValue формирует значение заголовка Authorization для MWS Fusion:
// ожидается «Bearer {token}». В .env иногда кладут только токен, иногда уже с префиксом Bearer.
func authorizationHeaderValue(apiKey string) string {
	t := strings.TrimSpace(apiKey)
	if t == "" {
		return ""
	}
	const p = "bearer "
	if len(t) >= len(p) && strings.EqualFold(t[:len(p)], p) {
		return t
	}
	return "Bearer " + t
}

func ptrStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

type ClientWrapper struct {
	genClient  *ClientWithResponses
	httpClient *resty.Client
	baseURL    string
	apiKey     string
}

func NewClientWrapper(baseURL, apiKey string, requestTimeout time.Duration) (*ClientWrapper, error) {
	server := normalizeFusionBaseURL(baseURL)
	authHeader := authorizationHeaderValue(apiKey)

	httpClient := resty.New().
		SetBaseURL(server).
		SetTimeout(requestTimeout).
		SetHeader("Content-Type", "application/json").
		OnAfterResponse(func(_ *resty.Client, r *resty.Response) error {
			if r.IsError() {
				return fmt.Errorf("http error: status=%s, body=%s", r.Status(), string(r.Body()))
			}
			return nil
		})

	// Сгенерированный клиент вызывает http.Client.Do() со своими Request — resty SetAuthToken на такие
	// запросы не действует. Fusion требует Authorization на каждом вызове.
	genClient, err := NewClientWithResponses(
		server,
		WithHTTPClient(httpClient.GetClient()),
		WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			if authHeader != "" {
				req.Header.Set("Authorization", authHeader)
			}
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}

	return &ClientWrapper{
		httpClient: httpClient,
		baseURL:    server,
		apiKey:     apiKey,
		genClient:  genClient,
	}, nil
}
