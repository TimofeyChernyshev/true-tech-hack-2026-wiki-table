package mwsclient

import (
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
)

type ClientWrapper struct {
	ClientInterface
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

	c := &ClientWrapper{
		httpClient: httpClient,
		baseURL:    baseURL,
		apiKey:     apiKey,
	}

	genClient, err := NewClientWithResponses(baseURL, WithHTTPClient(httpClient.GetClient()))
	if err != nil {
		return nil, fmt.Errorf("failed to create generated client: %w", err)
	}
	c.ClientInterface = genClient

	return c, nil
}
