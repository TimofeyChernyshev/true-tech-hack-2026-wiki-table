package domain

type Message struct {
	Content string
	Role    MessageRole
}

type MessageRole string
