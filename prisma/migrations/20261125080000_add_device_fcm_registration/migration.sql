CREATE TABLE "device_fcm_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "device_fcm_tokens_token_key" ON "device_fcm_tokens"("token");
CREATE INDEX "device_fcm_tokens_user_id_idx" ON "device_fcm_tokens"("user_id");

CREATE TABLE "device_registration_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_registration_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "device_registration_keys_key_hash_key" ON "device_registration_keys"("key_hash");
CREATE INDEX "device_registration_keys_user_id_idx" ON "device_registration_keys"("user_id");
