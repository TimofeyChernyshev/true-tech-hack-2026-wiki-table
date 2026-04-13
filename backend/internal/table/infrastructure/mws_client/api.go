package mwsclient

import "fmt"

type Table struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
}

type ListTablesResponse struct {
	Data   []Table `json:"data"`
	Total  int     `json:"total"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details"`
}

func (e *ErrorResponse) Error() string {
	return fmt.Sprintf("mws api error: code=%d, message=%s, details=%s", e.Code, e.Message, e.Details)
}
