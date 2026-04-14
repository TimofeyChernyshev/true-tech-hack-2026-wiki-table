package domain

// GenerateRequest параметры для генерации
type GenerateRequest struct {
	Model         string
	Prompt        string
	Temperature   *float32
	MaxTokens     *int
	StopSequences []string
}
