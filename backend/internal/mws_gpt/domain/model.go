package domain

type Model struct {
	Created int64 `json:"created"`

	Id     string      `json:"id"`
	Object ModelObject `json:"object"`

	OwnedBy string `json:"owned_by"`
}

type ModelObject string
