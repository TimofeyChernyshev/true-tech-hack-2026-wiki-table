package tableshttp

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var wikiPageKeyRe = regexp.MustCompile(`^[a-zA-Z0-9._-]{1,160}$`)

func validateWikiPageKey(key string) error {
	k := strings.TrimSpace(key)
	if k == "" || !wikiPageKeyRe.MatchString(k) {
		return errors.New("invalid page key")
	}
	return nil
}

func (s *Server) wikiJSONPath(pageKey string) (string, error) {
	if err := validateWikiPageKey(pageKey); err != nil {
		return "", err
	}
	base := filepath.Clean(s.wikiDataDir)
	if !filepath.IsAbs(base) {
		var err error
		base, err = filepath.Abs(base)
		if err != nil {
			return "", err
		}
	}
	full := filepath.Join(base, pageKey+".json")
	if rel, err := filepath.Rel(base, full); err != nil || strings.HasPrefix(rel, "..") {
		return "", errors.New("invalid path")
	}
	return full, nil
}

func (s *Server) getWikiPage(c *gin.Context) {
	if s.wikiDataDir == "" {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: http.StatusNotFound, Message: "wiki storage disabled"})
		return
	}
	p, err := s.wikiJSONPath(c.Param("pageKey"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: http.StatusBadRequest, Message: err.Error()})
		return
	}
	data, err := os.ReadFile(p)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			c.JSON(http.StatusNotFound, ErrorResponse{Code: http.StatusNotFound, Message: "page not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: http.StatusInternalServerError, Message: "read failed"})
		return
	}
	if !json.Valid(data) {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: http.StatusInternalServerError, Message: "stored document is not valid JSON"})
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}

func (s *Server) putWikiPage(c *gin.Context) {
	if s.wikiDataDir == "" {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{Code: http.StatusServiceUnavailable, Message: "wiki storage disabled"})
		return
	}
	p, err := s.wikiJSONPath(c.Param("pageKey"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: http.StatusBadRequest, Message: err.Error()})
		return
	}
	var raw json.RawMessage
	if err := c.ShouldBindJSON(&raw); err != nil {
		errText := err.Error()
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    http.StatusBadRequest,
			Message: "invalid JSON body",
			Details: &errText,
		})
		return
	}
	if len(raw) == 0 || !json.Valid(raw) {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: http.StatusBadRequest, Message: "body must be valid JSON"})
		return
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: http.StatusInternalServerError, Message: "write failed"})
		return
	}
	if err := os.Rename(tmp, p); err != nil {
		_ = os.Remove(tmp)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: http.StatusInternalServerError, Message: "rename failed"})
		return
	}
	c.Status(http.StatusNoContent)
}
