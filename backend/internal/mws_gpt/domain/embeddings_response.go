package domain

// EmbeddingsResponse ответ эмбеддингов
type EmbeddingsResponse struct {
	Embeddings [][]float32
	Model      string
	Usage      TokenUsage
}
