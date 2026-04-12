package domain

type Pagination struct {
	PageNum  int  `json:"pageNum"`
	PageSize int  `json:"pageSize"`
	Total    int  `json:"total"`
	HasMore  bool `json:"hasMore"`
}
