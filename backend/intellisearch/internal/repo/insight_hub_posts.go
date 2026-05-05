package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"norter/intellisearch/internal/db"
)

// InsightHubPostRow item para listagem.
type InsightHubPostRow struct {
	ID            string  `json:"id"`
	BrandID       string  `json:"brandId"`
	Provider      string  `json:"provider"`
	ExternalID    string  `json:"externalId"`
	Permalink     string  `json:"permalink,omitempty"`
	Message       string  `json:"message,omitempty"`
	MediaType     string  `json:"mediaType,omitempty"`
	MediaURL      string  `json:"mediaUrl,omitempty"`
	ThumbnailURL  string  `json:"thumbnailUrl,omitempty"`
	PublishedAt   *string `json:"publishedAt,omitempty"`
	Reach         int     `json:"reach"`
	Impressions   int     `json:"impressions"`
	Likes         int     `json:"likes"`
	Comments      int     `json:"comments"`
	Shares        int     `json:"shares"`
	Saves         int     `json:"saves"`
	VideoViews    int     `json:"videoViews"`
	Engagement    int     `json:"engagement"`
}

// InsightHubPostInput payload para upsert.
type InsightHubPostInput struct {
	OrgID            string
	BrandID          string
	ConnectionID     string
	Provider         string
	ExternalAccountID string
	ExternalPostID   string
	Permalink        string
	Message          string
	MediaType        string
	MediaURL         string
	ThumbnailURL     string
	PublishedAt      *time.Time
	Reach            *int
	Impressions      *int
	Likes            *int
	Comments         *int
	Shares           *int
	Saves            *int
	VideoViews       *int
	Engagement       *int
	RawJSON          string
}

func nilIfNilInt(v *int) interface{} {
	if v == nil {
		return nil
	}
	return *v
}

// UpsertInsightHubPost insere ou atualiza um post pelo par (connection_id, external_post_id).
func UpsertInsightHubPost(ctx context.Context, in InsightHubPostInput) (string, error) {
	if db.DB == nil {
		return "", errors.New("mysql indisponível")
	}
	oid := strings.TrimSpace(in.OrgID)
	bid := strings.TrimSpace(in.BrandID)
	cid := strings.TrimSpace(in.ConnectionID)
	ext := strings.TrimSpace(in.ExternalPostID)
	if oid == "" || bid == "" || cid == "" || ext == "" {
		return "", errors.New("dados em falta")
	}

	var existingID string
	err := db.DB.QueryRowContext(ctx,
		`SELECT id FROM insight_hub_posts WHERE connection_id = ? AND external_post_id = ?`, cid, ext,
	).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	var publishedAt interface{}
	if in.PublishedAt != nil {
		publishedAt = in.PublishedAt.UTC().Format("2006-01-02 15:04:05.000")
	}

	if existingID != "" {
		_, err = db.DB.ExecContext(ctx, `
UPDATE insight_hub_posts SET
  permalink = NULLIF(?,''),
  message = ?,
  media_type = NULLIF(?,''),
  media_url = NULLIF(?,''),
  thumbnail_url = NULLIF(?,''),
  published_at = ?,
  reach = ?, impressions = ?, likes = ?, comments = ?, shares = ?, saves = ?, video_views = ?, engagement = ?,
  raw_json = ?,
  fetched_at = UTC_TIMESTAMP(3),
  updated_at = UTC_TIMESTAMP(3)
WHERE id = ?`,
			in.Permalink, nullIfEmpty(in.Message), in.MediaType, in.MediaURL, in.ThumbnailURL, publishedAt,
			nilIfNilInt(in.Reach), nilIfNilInt(in.Impressions), nilIfNilInt(in.Likes), nilIfNilInt(in.Comments),
			nilIfNilInt(in.Shares), nilIfNilInt(in.Saves), nilIfNilInt(in.VideoViews), nilIfNilInt(in.Engagement),
			nullIfEmptyJSONString(in.RawJSON), existingID,
		)
		return existingID, err
	}

	id := NewUUID()
	_, err = db.DB.ExecContext(ctx, `
INSERT INTO insight_hub_posts
  (id, organization_id, brand_id, connection_id, provider, external_post_id, external_account_id,
   permalink, message, media_type, media_url, thumbnail_url, published_at,
   reach, impressions, likes, comments, shares, saves, video_views, engagement,
   raw_json, fetched_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, NULLIF(?,''),
        NULLIF(?,''), ?, NULLIF(?,''), NULLIF(?,''), NULLIF(?,''), ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		id, oid, bid, cid, in.Provider, ext, in.ExternalAccountID,
		in.Permalink, nullIfEmpty(in.Message), in.MediaType, in.MediaURL, in.ThumbnailURL, publishedAt,
		nilIfNilInt(in.Reach), nilIfNilInt(in.Impressions), nilIfNilInt(in.Likes), nilIfNilInt(in.Comments),
		nilIfNilInt(in.Shares), nilIfNilInt(in.Saves), nilIfNilInt(in.VideoViews), nilIfNilInt(in.Engagement),
		nullIfEmptyJSONString(in.RawJSON),
	)
	return id, err
}

// ListInsightHubPosts paginação simples por brand + intervalo.
func ListInsightHubPosts(
	ctx context.Context, orgID, brandID string, from, to time.Time, sortBy, sortDir string, limit, offset int,
) ([]InsightHubPostRow, int, error) {
	if db.DB == nil {
		return nil, 0, errors.New("mysql indisponível")
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	allowedSort := map[string]string{
		"published_at": "published_at",
		"engagement":   "engagement",
		"reach":        "reach",
		"impressions":  "impressions",
		"likes":        "likes",
	}
	col, ok := allowedSort[strings.ToLower(strings.TrimSpace(sortBy))]
	if !ok {
		col = "published_at"
	}
	dir := "DESC"
	if strings.EqualFold(strings.TrimSpace(sortDir), "asc") {
		dir = "ASC"
	}

	rows, err := db.DB.QueryContext(ctx, `
SELECT id, brand_id, provider, external_post_id, COALESCE(permalink,''), COALESCE(message,''),
       COALESCE(media_type,''), COALESCE(media_url,''), COALESCE(thumbnail_url,''),
       DATE_FORMAT(published_at, '%Y-%m-%dT%H:%i:%sZ'),
       COALESCE(reach,0), COALESCE(impressions,0), COALESCE(likes,0), COALESCE(comments,0),
       COALESCE(shares,0), COALESCE(saves,0), COALESCE(video_views,0), COALESCE(engagement,0)
FROM insight_hub_posts
WHERE organization_id = ? AND brand_id = ?
  AND (published_at IS NULL OR published_at BETWEEN ? AND ?)
ORDER BY `+col+` `+dir+` LIMIT ? OFFSET ?`,
		strings.TrimSpace(orgID), strings.TrimSpace(brandID),
		from.UTC().Format("2006-01-02 15:04:05.000"),
		to.UTC().Format("2006-01-02 23:59:59.000"),
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []InsightHubPostRow
	for rows.Next() {
		var p InsightHubPostRow
		var pub sql.NullString
		if err := rows.Scan(&p.ID, &p.BrandID, &p.Provider, &p.ExternalID, &p.Permalink, &p.Message,
			&p.MediaType, &p.MediaURL, &p.ThumbnailURL, &pub,
			&p.Reach, &p.Impressions, &p.Likes, &p.Comments, &p.Shares, &p.Saves, &p.VideoViews, &p.Engagement); err != nil {
			return nil, 0, err
		}
		if pub.Valid {
			s := pub.String
			p.PublishedAt = &s
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	var total int
	_ = db.DB.QueryRowContext(ctx, `
SELECT COUNT(1) FROM insight_hub_posts
WHERE organization_id = ? AND brand_id = ?
  AND (published_at IS NULL OR published_at BETWEEN ? AND ?)`,
		strings.TrimSpace(orgID), strings.TrimSpace(brandID),
		from.UTC().Format("2006-01-02 15:04:05.000"),
		to.UTC().Format("2006-01-02 23:59:59.000"),
	).Scan(&total)
	return out, total, nil
}
