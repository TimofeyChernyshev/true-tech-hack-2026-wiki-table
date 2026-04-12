package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	mwsclient "true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/infrastructure/mws_client"
)

// TableRecordsHandler обрабатывает GET /api/v1/tables/{dstId}/records по контракту back-front.yaml.
type TableRecordsHandler struct {
	Fusion *mwsclient.ClientWithResponses
}

func (h *TableRecordsHandler) ServeGetTableRecords(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dstID := strings.TrimSpace(r.PathValue("dstId"))
	if dstID == "" {
		writeErrJSON(w, http.StatusBadRequest, "missing dstId path parameter")
		return
	}

	q := r.URL.Query()
	viewID := strings.TrimSpace(q.Get("viewId"))

	pageNum, err := parseIntQuery(q, "pageNum", 1, 1, 0)
	if err != nil {
		writeErrJSON(w, http.StatusBadRequest, "invalid pageNum: "+err.Error())
		return
	}

	pageSize, err := parseIntQuery(q, "pageSize", 100, 1, 150)
	if err != nil {
		writeErrJSON(w, http.StatusBadRequest, "invalid pageSize: "+err.Error())
		return
	}

	var maxRecords *int
	if v := strings.TrimSpace(q.Get("maxRecords")); v != "" {
		n, perr := strconv.Atoi(v)
		if perr != nil || n < 1 || n > 1000 {
			writeErrJSON(w, http.StatusBadRequest, "maxRecords must be an integer between 1 and 1000")
			return
		}
		maxRecords = &n
	}

	fk := mwsclient.GetFusionV1DatasheetsDstIdRecordsParamsFieldKeyName
	params := &mwsclient.GetFusionV1DatasheetsDstIdRecordsParams{
		PageNum:  &pageNum,
		PageSize: &pageSize,
		FieldKey: &fk,
	}
	if viewID != "" {
		params.ViewId = &viewID
	}
	if maxRecords != nil {
		params.MaxRecords = maxRecords
	}

	ctx := r.Context()
	resp, err := h.Fusion.GetFusionV1DatasheetsDstIdRecordsWithResponse(ctx, dstID, params)
	if err != nil {
		writeErrJSON(w, http.StatusInternalServerError, "upstream request failed: "+err.Error())
		return
	}

	sc := resp.StatusCode()
	if sc != http.StatusOK {
		msg, details := fusionErrorMessage(resp)
		writeErrorResponse(w, sc, msg, details)
		return
	}

	if resp.JSON200 == nil {
		writeErrorResponse(w, http.StatusBadGateway, "empty JSON body from upstream", string(resp.Body))
		return
	}

	gr := resp.JSON200
	if gr.Success != nil && !*gr.Success {
		code := http.StatusBadRequest
		if gr.Code != nil && *gr.Code == 404 {
			code = http.StatusNotFound
		}
		msg := ""
		if gr.Message != nil {
			msg = *gr.Message
		}
		if msg == "" {
			msg = "upstream reported failure"
		}
		writeErrorResponse(w, code, msg, string(resp.Body))
		return
	}

	out, mapErr := mapFusionToTableRecords(gr, pageNum, pageSize)
	if mapErr != nil {
		writeErrJSON(w, http.StatusInternalServerError, mapErr.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(out)
}

func mapFusionToTableRecords(gr *mwsclient.GetRecordsData, fallbackPageNum, fallbackPageSize int) (TableRecordsResponse, error) {
	out := TableRecordsResponse{
		PageNum:  fallbackPageNum,
		PageSize: fallbackPageSize,
		Records:  []TableRecord{},
	}

	if gr.Data == nil {
		return out, nil
	}

	d := gr.Data
	if d.PageNum != nil {
		out.PageNum = *d.PageNum
	}
	if d.PageSize != nil {
		out.PageSize = *d.PageSize
	}

	if d.Records == nil {
		return out, nil
	}

	for _, rec := range *d.Records {
		if rec.RecordId == nil || *rec.RecordId == "" {
			continue
		}
		fields := map[string]interface{}{}
		if rec.Fields != nil {
			fields = *rec.Fields
		}
		tr := TableRecord{
			RecordId: *rec.RecordId,
			Fields:   fields,
		}
		if rec.CreatedAt != nil {
			v := int64(*rec.CreatedAt)
			tr.CreatedAt = &v
		}
		if rec.UpdatedAt != nil {
			v := int64(*rec.UpdatedAt)
			tr.UpdatedAt = &v
		}
		out.Records = append(out.Records, tr)
	}

	return out, nil
}

func fusionErrorMessage(resp *mwsclient.GetFusionV1DatasheetsDstIdRecordsResponse) (message, details string) {
	details = string(resp.Body)
	if resp.JSON200 != nil && resp.JSON200.Message != nil && *resp.JSON200.Message != "" {
		return *resp.JSON200.Message, details
	}
	var generic struct {
		Message *string `json:"message"`
	}
	if err := json.Unmarshal(resp.Body, &generic); err == nil && generic.Message != nil && *generic.Message != "" {
		return *generic.Message, details
	}
	if details != "" {
		return "upstream error", details
	}
	return "upstream error", ""
}

func writeErrJSON(w http.ResponseWriter, status int, msg string) {
	writeErrorResponse(w, status, msg, "")
}

func writeErrorResponse(w http.ResponseWriter, httpStatus int, message, details string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(ErrorResponse{
		Code:    httpStatus,
		Message: message,
		Details: details,
	})
}

func parseIntQuery(q url.Values, key string, def, min, max int) (int, error) {
	v := strings.TrimSpace(q.Get(key))
	if v == "" {
		return def, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, fmt.Errorf("not an integer")
	}
	if n < min {
		return 0, fmt.Errorf("must be >= %d", min)
	}
	if max > 0 && n > max {
		return 0, fmt.Errorf("must be <= %d", max)
	}
	return n, nil
}

// WithCORS добавляет заголовки CORS и обрабатывает OPTIONS для локальной разработки с Vite.
func WithCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// normalizeFusionBaseURL убирает хвост /fusion/v1, если он указан.
// Сгенерированный клиент сам добавляет относительный путь ./fusion/v1/...;
// при базе .../fusion/v1 получается .../fusion/fusion/v1/... и MWS отвечает 404 «API не существует».
func normalizeFusionBaseURL(raw string) string {
	u := strings.TrimSpace(strings.TrimRight(raw, "/"))
	for {
		lower := strings.ToLower(u)
		if !strings.HasSuffix(lower, "/fusion/v1") {
			break
		}
		u = u[:len(u)-len("/fusion/v1")]
		u = strings.TrimRight(u, "/")
	}
	return u
}

// NewFusionClient создаёт клиент Fusion API без resty-хуков, чтобы корректно обрабатывать 4xx/5xx.
func NewFusionClient(baseURL, apiKey string, timeout time.Duration) (*mwsclient.ClientWithResponses, error) {
	if strings.TrimSpace(baseURL) == "" {
		return nil, fmt.Errorf("empty base URL")
	}
	server := normalizeFusionBaseURL(baseURL)
	httpClient := &http.Client{Timeout: timeout}
	return mwsclient.NewClientWithResponses(
		server,
		mwsclient.WithHTTPClient(httpClient),
		mwsclient.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Set("Authorization", "Bearer "+apiKey)
			return nil
		}),
	)
}
