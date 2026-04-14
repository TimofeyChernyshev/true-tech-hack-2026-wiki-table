package domain

type TokenUsage struct {
	// CompletionTokens Токенов в ответе
	CompletionTokens int

	// PromptTokens Токенов в запросе
	PromptTokens int

	// TotalTokens Всего токенов
	TotalTokens int
}
