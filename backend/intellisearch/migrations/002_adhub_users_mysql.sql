-- DEPRECATED: o backend Go usa a tabela `users` definida em database/mysql/001_adhub_core.sql.
-- Não execute este ficheiro em bases novas — só mantido para referência / ambientes antigos.
--
-- Utilizadores AD-Hub (login centralizado; senha com bcrypt no servidor).
-- Executar na mesma base MySQL que MYSQL_DSN (ex.: cPanel → phpMyAdmin).

CREATE TABLE IF NOT EXISTS adhub_users (
  login_key VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (login_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
