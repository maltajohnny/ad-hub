/**
 * Modelo de dados multi-tenant para Gestão de Mídias (espelho TypeScript do desenho relacional).
 *
 * --- SQL equivalente (PostgreSQL, conceitual) ---
 *
 * CREATE TABLE media_organizations (
 *   id UUID PRIMARY KEY,
 *   tenant_id UUID NOT NULL REFERENCES tenants(id),
 *   updated_at TIMESTAMPTZ NOT NULL
 * );
 *
 * CREATE TABLE media_clients (
 *   id UUID PRIMARY KEY,
 *   org_id UUID NOT NULL REFERENCES media_organizations(id),
 *   name TEXT NOT NULL,
 *   email TEXT NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL
 * );
 *
 * CREATE TABLE media_platform_connections (
 *   id UUID PRIMARY KEY,
 *   media_client_id UUID NOT NULL REFERENCES media_clients(id) ON DELETE CASCADE,
 *   platform TEXT NOT NULL,
 *   status TEXT NOT NULL,
 *   external_account_id TEXT,
 *   oauth_refresh_token_encrypted BYTEA,
 *   updated_at TIMESTAMPTZ NOT NULL
 * );
 *
 * CREATE TABLE media_managed_ad_accounts (
 *   id UUID PRIMARY KEY,
 *   media_client_id UUID NOT NULL REFERENCES media_clients(id) ON DELETE CASCADE,
 *   platform TEXT NOT NULL,
 *   external_account_id TEXT NOT NULL,
 *   display_name TEXT NOT NULL,
 *   selected BOOLEAN NOT NULL DEFAULT true
 * );
 *
 * CREATE TABLE media_managers (
 *   id UUID PRIMARY KEY,
 *   org_id UUID NOT NULL,
 *   user_id UUID REFERENCES users(id),
 *   email TEXT,
 *   active BOOLEAN NOT NULL DEFAULT true
 * );
 *
 * CREATE TABLE media_manager_permissions (
 *   manager_id UUID REFERENCES media_managers(id) ON DELETE CASCADE,
 *   media_client_id UUID REFERENCES media_clients(id) ON DELETE CASCADE,
 *   platform TEXT NOT NULL,
 *   can_manage_campaigns BOOLEAN NOT NULL,
 *   can_manage_ad_sets BOOLEAN NOT NULL,
 *   can_manage_ads BOOLEAN NOT NULL,
 *   can_create_campaigns BOOLEAN NOT NULL,
 *   can_edit_creatives BOOLEAN NOT NULL,
 *   can_view_metrics BOOLEAN NOT NULL,
 *   PRIMARY KEY (manager_id, media_client_id, platform)
 * );
 *
 * CREATE TABLE media_audit_log (
 *   id UUID PRIMARY KEY,
 *   org_id UUID NOT NULL,
 *   actor_username TEXT NOT NULL,
 *   action TEXT NOT NULL,
 *   detail TEXT NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL
 * );
 *
 * CREATE TABLE media_performance_snapshots (
 *   id UUID PRIMARY KEY,
 *   media_client_id UUID NOT NULL REFERENCES media_clients(id) ON DELETE CASCADE,
 *   total_spend NUMERIC NOT NULL,
 *   roi NUMERIC NOT NULL,
 *   cpa NUMERIC NOT NULL,
 *   currency TEXT NOT NULL,
 *   synced_at TIMESTAMPTZ NOT NULL
 * );
 */

export type MediaSchemaVersion = "v2-localstorage" | "v3-postgres";
