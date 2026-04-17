package domain

// GenerateResponse ответ генерации
type GenerateResponse struct {
	ID    string
	Text  string
	Model string
	Usage TokenUsage
}
