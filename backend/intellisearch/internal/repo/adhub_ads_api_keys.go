package repo

import (
	"context"
	"database/sql"
)

type AdsAPIKeysConfig struct {
	MetaAppID               string `json:"metaAppId"`
	MetaAppSecret           string `json:"metaAppSecret"`
	TiktokAppID             string `json:"tiktokAppId"`
	TiktokClientKey         string `json:"tiktokClientKey"`
	TiktokAppSecret         string `json:"tiktokAppSecret"`
	GoogleOauthClientID     string `json:"googleOauthClientId"`
	GoogleOauthClientSecret string `json:"googleOauthClientSecret"`
	InstagramGraphAPIToken  string `json:"instagramGraphApiToken"`
	SerpApiKey              string `json:"serpApiKey"`
	DataForSeoLogin         string `json:"dataForSeoLogin"`
	DataForSeoPassword      string `json:"dataForSeoPassword"`
	MetaAdsLibraryToken     string `json:"metaAdsLibraryToken"`
	HunterApiKey            string `json:"hunterApiKey"`
	GooglePlacesApiKey      string `json:"googlePlacesApiKey"`
	SendgridApiKey          string `json:"sendgridApiKey"`
	TwilioAuthToken         string `json:"twilioAuthToken"`
	TwilioAccountSID        string `json:"twilioAccountSid"`
	WhatsappMetaAccessToken string `json:"whatsappMetaAccessToken"`
}

func EnsureAdsAPIKeysTable(ctx context.Context, db *sql.DB) error {
	const q = `
CREATE TABLE IF NOT EXISTS ads_api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope ENUM('platform') NOT NULL DEFAULT 'platform',
  scope_id VARCHAR(64) NOT NULL DEFAULT 'global',

  meta_app_id VARCHAR(255) NULL,
  meta_app_secret TEXT NULL,
  instagram_graph_api_token TEXT NULL,
  meta_ads_library_token TEXT NULL,

  tiktok_app_id VARCHAR(255) NULL,
  tiktok_client_key VARCHAR(255) NULL,
  tiktok_app_secret TEXT NULL,

  google_oauth_client_id VARCHAR(255) NULL,
  google_oauth_client_secret TEXT NULL,
  google_places_api_key TEXT NULL,

  serpapi_key TEXT NULL,
  dataforseo_login VARCHAR(255) NULL,
  dataforseo_password TEXT NULL,

  hunter_api_key TEXT NULL,

  sendgrid_api_key TEXT NULL,
  twilio_account_sid VARCHAR(255) NULL,
  twilio_auth_token TEXT NULL,
  whatsapp_meta_access_token TEXT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ads_api_keys_scope (scope, scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
	_, err := db.ExecContext(ctx, q)
	return err
}

func GetPlatformAdsAPIKeysConfig(ctx context.Context, db *sql.DB) (AdsAPIKeysConfig, error) {
	const q = `
SELECT
  COALESCE(meta_app_id, ''),
  COALESCE(meta_app_secret, ''),
  COALESCE(tiktok_app_id, ''),
  COALESCE(tiktok_client_key, ''),
  COALESCE(tiktok_app_secret, ''),
  COALESCE(google_oauth_client_id, ''),
  COALESCE(google_oauth_client_secret, ''),
  COALESCE(instagram_graph_api_token, ''),
  COALESCE(serpapi_key, ''),
  COALESCE(dataforseo_login, ''),
  COALESCE(dataforseo_password, ''),
  COALESCE(meta_ads_library_token, ''),
  COALESCE(hunter_api_key, ''),
  COALESCE(google_places_api_key, ''),
  COALESCE(sendgrid_api_key, ''),
  COALESCE(twilio_auth_token, ''),
  COALESCE(twilio_account_sid, ''),
  COALESCE(whatsapp_meta_access_token, '')
FROM ads_api_keys
WHERE scope = 'platform' AND scope_id = 'global'
LIMIT 1`
	var out AdsAPIKeysConfig
	err := db.QueryRowContext(ctx, q).Scan(
		&out.MetaAppID,
		&out.MetaAppSecret,
		&out.TiktokAppID,
		&out.TiktokClientKey,
		&out.TiktokAppSecret,
		&out.GoogleOauthClientID,
		&out.GoogleOauthClientSecret,
		&out.InstagramGraphAPIToken,
		&out.SerpApiKey,
		&out.DataForSeoLogin,
		&out.DataForSeoPassword,
		&out.MetaAdsLibraryToken,
		&out.HunterApiKey,
		&out.GooglePlacesApiKey,
		&out.SendgridApiKey,
		&out.TwilioAuthToken,
		&out.TwilioAccountSID,
		&out.WhatsappMetaAccessToken,
	)
	if err == sql.ErrNoRows {
		return AdsAPIKeysConfig{}, nil
	}
	return out, err
}

func UpsertPlatformAdsAPIKeysConfig(ctx context.Context, db *sql.DB, in AdsAPIKeysConfig) error {
	const q = `
INSERT INTO ads_api_keys (
  scope, scope_id,
  meta_app_id, meta_app_secret, instagram_graph_api_token, meta_ads_library_token,
  tiktok_app_id, tiktok_client_key, tiktok_app_secret,
  google_oauth_client_id, google_oauth_client_secret, google_places_api_key,
  serpapi_key, dataforseo_login, dataforseo_password,
  hunter_api_key, sendgrid_api_key, twilio_account_sid, twilio_auth_token, whatsapp_meta_access_token
) VALUES (
  'platform', 'global',
  ?, ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  ?, ?, ?, ?, ?
)
ON DUPLICATE KEY UPDATE
  meta_app_id = VALUES(meta_app_id),
  meta_app_secret = VALUES(meta_app_secret),
  instagram_graph_api_token = VALUES(instagram_graph_api_token),
  meta_ads_library_token = VALUES(meta_ads_library_token),
  tiktok_app_id = VALUES(tiktok_app_id),
  tiktok_client_key = VALUES(tiktok_client_key),
  tiktok_app_secret = VALUES(tiktok_app_secret),
  google_oauth_client_id = VALUES(google_oauth_client_id),
  google_oauth_client_secret = VALUES(google_oauth_client_secret),
  google_places_api_key = VALUES(google_places_api_key),
  serpapi_key = VALUES(serpapi_key),
  dataforseo_login = VALUES(dataforseo_login),
  dataforseo_password = VALUES(dataforseo_password),
  hunter_api_key = VALUES(hunter_api_key),
  sendgrid_api_key = VALUES(sendgrid_api_key),
  twilio_account_sid = VALUES(twilio_account_sid),
  twilio_auth_token = VALUES(twilio_auth_token),
  whatsapp_meta_access_token = VALUES(whatsapp_meta_access_token),
  updated_at = CURRENT_TIMESTAMP`
	_, err := db.ExecContext(
		ctx,
		q,
		in.MetaAppID,
		in.MetaAppSecret,
		in.InstagramGraphAPIToken,
		in.MetaAdsLibraryToken,
		in.TiktokAppID,
		in.TiktokClientKey,
		in.TiktokAppSecret,
		in.GoogleOauthClientID,
		in.GoogleOauthClientSecret,
		in.GooglePlacesApiKey,
		in.SerpApiKey,
		in.DataForSeoLogin,
		in.DataForSeoPassword,
		in.HunterApiKey,
		in.SendgridApiKey,
		in.TwilioAccountSID,
		in.TwilioAuthToken,
		in.WhatsappMetaAccessToken,
	)
	return err
}
