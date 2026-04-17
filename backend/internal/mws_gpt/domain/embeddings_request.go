package domain

// EmbeddingsRequest параметры для эмбеддингов
type EmbeddingsRequest struct {
	Model string
	Input []string
}
