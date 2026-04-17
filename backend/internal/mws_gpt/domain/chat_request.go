package domain

type ChatRequest struct {
	Model        string
	Messages     []Message
	Temperature  *float32
	MaxTokens    *int
	SystemPrompt *string
}
