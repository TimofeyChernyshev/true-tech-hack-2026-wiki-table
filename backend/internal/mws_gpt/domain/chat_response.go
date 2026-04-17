package domain

type ChatResponse struct {
	ID      string
	Message Message
	Model   string
	Usage   TokenUsage
}
