package domain

type Role string

const (
	RoleReader Role = "reader"
	RoleEditor Role = "editor"
	RoleAdmin  Role = "admin"
)
