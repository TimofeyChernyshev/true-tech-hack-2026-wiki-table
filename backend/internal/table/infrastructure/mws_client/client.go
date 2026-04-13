package mwsclient

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-resty/resty/v2"
)

type ClientWrapper struct {
	genClient  *ClientWithResponses
	httpClient *resty.Client
	baseURL    string
	apiKey     string
}

func NewClientWrapper(baseURL, apiKey string, requestTimeout time.Duration) (*ClientWrapper, error) {
	httpClient := resty.New().
		SetBaseURL(baseURL).
		SetTimeout(requestTimeout).
		SetAuthScheme("Bearer").
		SetAuthToken(apiKey).
		SetHeader("Content-Type", "application/json").
		OnAfterResponse(func(_ *resty.Client, r *resty.Response) error {
			if r.IsError() {
				return fmt.Errorf("http error: status=%s, body=%s", r.Status(), string(r.Body()))
			}

			return nil
		})

	genClient, err := NewClientWithResponses(
		baseURL,
		WithHTTPClient(httpClient.GetClient()),
		WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
			req.Header.Set("Authorization", "Bearer "+apiKey)
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}

	return &ClientWrapper{
		httpClient: httpClient,
		baseURL:    baseURL,
		apiKey:     apiKey,
		genClient:  genClient,
	}, nil
}
