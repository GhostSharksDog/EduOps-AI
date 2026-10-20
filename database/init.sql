-- 教培运营分析辅助系统：仅用于空 PostgreSQL 数据库。已有数据库禁止执行。

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "TargetTableStatus" AS ENUM ('DRAFT','CREATE_FAILED','CREATED','ACTIVE','INACTIVE');

CREATE TABLE "local_user" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" VARCHAR(100) NOT NULL UNIQUE,
  "password_hash" VARCHAR(256) NOT NULL,
  "real_name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(255),
  "role" VARCHAR(20) NOT NULL DEFAULT 'viewer',
  "organization_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE "tag_category" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "parent_id" UUID,
  "path" VARCHAR(1024) NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_tag_category_name" ON "tag_category" ("name");

CREATE INDEX "idx_tag_category_parent_id" ON "tag_category" ("parent_id");

CREATE INDEX "idx_tag_category_path" ON "tag_category" ("path");

CREATE INDEX "idx_tag_category_order" ON "tag_category" ("order");

CREATE INDEX "idx_tag_category_is_deleted" ON "tag_category" ("is_deleted");

CREATE TABLE "tag_version" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "tag_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "value_type" VARCHAR(50) NOT NULL,
  "calculation_rule" JSONB NOT NULL,
  "is_current" BOOLEAN DEFAULT false,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "enum_values" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_tag_version_tag_id" ON "tag_version" ("tag_id");

CREATE INDEX "idx_tag_version_is_current" ON "tag_version" ("is_current");

CREATE INDEX "idx_tag_version_is_deleted" ON "tag_version" ("is_deleted");

CREATE TABLE "tag_storage_config" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag_id" UUID NOT NULL,
  "bitmap_table_name" VARCHAR(255) NOT NULL,
  "bit_position" INTEGER,
  "enum_value" VARCHAR(100) NOT NULL DEFAULT '',
  "storage_type" VARCHAR(50) NOT NULL,
  "entity_type" VARCHAR(50),
  "bitmap_table_id" UUID,
  "owned_by" UUID NOT NULL,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID,
  "deleted_by" UUID,
  UNIQUE ("bitmap_table_id","bit_position"),
  UNIQUE ("tag_id","enum_value")
);

CREATE INDEX "idx_tag_storage_config_tag_id" ON "tag_storage_config" ("tag_id");

CREATE INDEX "idx_tag_storage_config_bitmap_table_name" ON "tag_storage_config" ("bitmap_table_name");

CREATE INDEX "idx_tag_storage_config_delete_time" ON "tag_storage_config" ("delete_time");

CREATE INDEX "idx_tag_storage_config_owned_by" ON "tag_storage_config" ("owned_by");

CREATE TABLE "tag" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "value_type" VARCHAR(50) NOT NULL,
  "current_version_id" UUID UNIQUE,
  "category_id" UUID NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "update_cycle" VARCHAR(50),
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_tag_name" ON "tag" ("name");

CREATE INDEX "idx_tag_category_id" ON "tag" ("category_id");

CREATE INDEX "idx_tag_current_version_id" ON "tag" ("current_version_id");

CREATE INDEX "idx_tag_is_deleted" ON "tag" ("is_deleted");

CREATE INDEX "idx_tag_status" ON "tag" ("status");

CREATE TABLE "tag_bitmap_sync_state" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag_id" UUID NOT NULL UNIQUE,
  "sync_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "last_sync_time" TIMESTAMP(6),
  "last_synced_count" INTEGER,
  "last_full_sync_time" TIMESTAMP(6),
  "mv_last_refresh_time" TIMESTAMP(6),
  "tag_version" VARCHAR(50),
  "error_message" TEXT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID,
  "deleted_by" UUID,
  "owned_by" UUID NOT NULL
);

CREATE INDEX "idx_tag_bitmap_sync_state_sync_status" ON "tag_bitmap_sync_state" ("sync_status");

CREATE INDEX "idx_tag_bitmap_sync_state_owned_by" ON "tag_bitmap_sync_state" ("owned_by");

CREATE INDEX "idx_tag_bitmap_sync_state_delete_time" ON "tag_bitmap_sync_state" ("delete_time");

CREATE TABLE "tag_export_task" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "query_params" JSONB NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "total_count" INTEGER DEFAULT 0,
  "exported_count" INTEGER DEFAULT 0,
  "file_path" VARCHAR(512),
  "error_message" TEXT,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_tag_export_task_status" ON "tag_export_task" ("status");

CREATE INDEX "idx_tag_export_task_owned_by" ON "tag_export_task" ("owned_by");

CREATE INDEX "idx_tag_export_task_is_deleted" ON "tag_export_task" ("is_deleted");

CREATE TABLE "segment" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "entity_type" VARCHAR(50) NOT NULL,
  "compute_type" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "schedule_config" JSONB,
  "last_calculation_time" TIMESTAMP(6),
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_segment_name" ON "segment" ("name");

CREATE INDEX "idx_segment_owned_by" ON "segment" ("owned_by");

CREATE INDEX "idx_segment_status" ON "segment" ("status");

CREATE INDEX "idx_segment_is_deleted" ON "segment" ("is_deleted");

CREATE TABLE "segment_condition" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "segment_id" UUID NOT NULL,
  "parent_id" UUID,
  "condition_type" VARCHAR(50) NOT NULL,
  "operator" VARCHAR(50),
  "field_name" VARCHAR(255),
  "field_value" JSONB,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_segment_condition_segment_id" ON "segment_condition" ("segment_id");

CREATE INDEX "idx_segment_condition_parent_id" ON "segment_condition" ("parent_id");

CREATE TABLE "segment_calculation_task" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "segment_id" UUID NOT NULL,
  "start_time" TIMESTAMP(6),
  "end_time" TIMESTAMP(6),
  "status" VARCHAR(50) NOT NULL,
  "result_count" INTEGER DEFAULT 0,
  "error_message" TEXT,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_segment_calc_task_segment_id" ON "segment_calculation_task" ("segment_id");

CREATE INDEX "idx_segment_calc_task_status" ON "segment_calculation_task" ("status");

CREATE INDEX "idx_segment_calc_task_create_time" ON "segment_calculation_task" ("create_time");

CREATE TABLE "segment_member" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "segment_id" UUID NOT NULL,
  "member_id" VARCHAR(255) NOT NULL,
  "join_time" TIMESTAMP(6) DEFAULT NOW(),
  "join_method" VARCHAR(50) NOT NULL,
  "feature" JSONB,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_segment_member_segment_id" ON "segment_member" ("segment_id");

CREATE INDEX "idx_segment_member_member_id" ON "segment_member" ("member_id");

CREATE INDEX "idx_segment_member_join_time" ON "segment_member" ("join_time");

CREATE INDEX "idx_segment_member_owned_by" ON "segment_member" ("owned_by");

CREATE INDEX "idx_segment_member_is_deleted" ON "segment_member" ("is_deleted");

CREATE TABLE "data_sources" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "host" VARCHAR(255) NOT NULL,
  "port" INTEGER NOT NULL,
  "database_name" VARCHAR(255) NOT NULL,
  "username" VARCHAR(255) NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DISABLED',
  "owned_by" UUID NOT NULL,
  "description" TEXT,
  "feature" JSONB,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID
);

CREATE INDEX "idx_data_sources_status" ON "data_sources" ("status");

CREATE INDEX "idx_data_sources_type" ON "data_sources" ("type");

CREATE TABLE "data_model" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "datasource_id" UUID NOT NULL,
  "table_name" VARCHAR(255),
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "owned_by" UUID NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID,
  UNIQUE ("owned_by","name")
);

CREATE INDEX "idx_data_model_datasource_id" ON "data_model" ("datasource_id");

CREATE INDEX "idx_data_model_status" ON "data_model" ("status");

CREATE INDEX "idx_data_model_owned_by" ON "data_model" ("owned_by");

CREATE INDEX "idx_data_model_is_deleted" ON "data_model" ("is_deleted");

CREATE TABLE "model_column" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "model_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "display_name" VARCHAR(255),
  "data_type" VARCHAR(50) NOT NULL,
  "length" INTEGER,
  "precision" INTEGER,
  "scale" INTEGER,
  "is_nullable" BOOLEAN NOT NULL DEFAULT true,
  "default_value" TEXT,
  "description" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_primary_key" BOOLEAN NOT NULL DEFAULT false,
  "owned_by" UUID NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "feature" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "deleted_by" UUID,
  UNIQUE ("model_id","name")
);

CREATE INDEX "idx_model_column_model_id" ON "model_column" ("model_id");

CREATE INDEX "idx_model_column_data_type" ON "model_column" ("data_type");

CREATE INDEX "idx_model_column_owned_by" ON "model_column" ("owned_by");

CREATE INDEX "idx_model_column_is_deleted" ON "model_column" ("is_deleted");

CREATE TABLE "bitmap_table" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_type_id" UUID NOT NULL,
  "owned_by" UUID NOT NULL,
  "total_bits" INTEGER NOT NULL DEFAULT 64,
  "name" VARCHAR(255),
  "description" TEXT,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "used_bits" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID,
  "deleted_by" UUID,
  "ch_table_name" VARCHAR(255),
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("owned_by","entity_type_id","sequence")
);

CREATE INDEX "idx_bitmap_table_entity_type_id" ON "bitmap_table" ("entity_type_id");

CREATE INDEX "idx_bitmap_table_entity_type" ON "bitmap_table" ("entity_type");

CREATE INDEX "idx_bitmap_table_name" ON "bitmap_table" ("name");

CREATE INDEX "idx_bitmap_table_status" ON "bitmap_table" ("status");

CREATE INDEX "idx_bitmap_table_delete_time" ON "bitmap_table" ("delete_time");

CREATE TABLE "tag_refresh_log" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag_id" UUID NOT NULL,
  "version_id" UUID,
  "mv_name" VARCHAR(255) NOT NULL,
  "owned_by" UUID NOT NULL,
  "error_message" TEXT,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID
);

CREATE INDEX "idx_tag_refresh_log_tag_id" ON "tag_refresh_log" ("tag_id");

CREATE INDEX "idx_tag_refresh_log_is_resolved" ON "tag_refresh_log" ("is_resolved");

CREATE INDEX "idx_tag_refresh_log_occurred_at" ON "tag_refresh_log" ("occurred_at");

CREATE INDEX "idx_tag_refresh_log_owned_by" ON "tag_refresh_log" ("owned_by");

CREATE TABLE "materialized_view_config" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "mv_name" VARCHAR(255) NOT NULL,
  "mv_result_table" VARCHAR(255) NOT NULL,
  "refresh_interval" VARCHAR(50) NOT NULL,
  "owned_by" UUID NOT NULL,
  "step_order" INTEGER NOT NULL DEFAULT 1,
  "is_cascade" BOOLEAN NOT NULL DEFAULT false,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID,
  "deleted_by" UUID,
  UNIQUE ("tag_id","version_id","step_order")
);

CREATE INDEX "idx_mv_config_tag_id" ON "materialized_view_config" ("tag_id");

CREATE INDEX "idx_mv_config_mv_name" ON "materialized_view_config" ("mv_name");

CREATE INDEX "idx_mv_config_delete_time" ON "materialized_view_config" ("delete_time");

CREATE INDEX "idx_mv_config_owned_by" ON "materialized_view_config" ("owned_by");

CREATE TABLE "target_table" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "table_name" VARCHAR(255) NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_type_id" UUID NOT NULL,
  "owned_by" UUID NOT NULL,
  "create_table_sql" JSONB NOT NULL,
  "table_type" VARCHAR(20) NOT NULL,
  "dimension_columns" TEXT,
  "aggregate_config" TEXT,
  "tag_id" UUID,
  "tag_version_id" UUID,
  "status" "TargetTableStatus" NOT NULL DEFAULT 'DRAFT',
  "error_message" TEXT,
  "activated_at" TIMESTAMP(6),
  "deactivated_at" TIMESTAMP(6),
  "row_count" INTEGER,
  "last_refresh_time" TIMESTAMP(6),
  "ch_exists" BOOLEAN,
  "ch_sync_time" TIMESTAMP(6),
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "delete_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID,
  "deleted_by" UUID,
  UNIQUE ("table_name")
);

CREATE INDEX "idx_target_table_entity_type_id" ON "target_table" ("entity_type_id");

CREATE INDEX "idx_target_table_tag_id" ON "target_table" ("tag_id");

CREATE INDEX "idx_target_table_status" ON "target_table" ("status");

CREATE INDEX "idx_target_table_is_deleted" ON "target_table" ("is_deleted");

CREATE INDEX "idx_target_table_delete_time" ON "target_table" ("delete_time");

CREATE INDEX "idx_target_table_owned_by" ON "target_table" ("owned_by");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "action" VARCHAR(50) NOT NULL,
  "entity" VARCHAR(50) NOT NULL,
  "entity_id" UUID,
  "actor_id" UUID NOT NULL,
  "actor_username" VARCHAR(255) NOT NULL,
  "actor_real_name" VARCHAR(255),
  "actor_email" VARCHAR(255),
  "actor_role" VARCHAR(50),
  "owned_by" UUID NOT NULL,
  "metadata" JSONB,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_audit_log_actor_id" ON "audit_logs" ("actor_id");

CREATE INDEX "idx_audit_log_entity" ON "audit_logs" ("entity","entity_id");

CREATE INDEX "idx_audit_log_action" ON "audit_logs" ("action");

CREATE INDEX "idx_audit_log_create_time" ON "audit_logs" ("create_time");

CREATE INDEX "idx_audit_log_owned_by" ON "audit_logs" ("owned_by");

CREATE TABLE "system_config" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "owned_by" UUID NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{"sessionTimeout":30,"pageSize":20,"language":"zh-CN","theme":"light"}'::jsonb,
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  "update_time" TIMESTAMP(6),
  "created_by" UUID,
  "updated_by" UUID,
  UNIQUE ("owned_by")
);

CREATE TABLE "education_dataset" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "license" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "dataCutoff" TIMESTAMPTZ(3) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "expectedRows" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  UNIQUE ("organizationId","key")
);

CREATE TABLE "education_import_batch" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "datasetId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "mapping" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'validating',
  "inputRows" INTEGER NOT NULL DEFAULT 0,
  "acceptedRows" INTEGER NOT NULL DEFAULT 0,
  "rejectedRows" INTEGER NOT NULL DEFAULT 0,
  "duplicateRows" INTEGER NOT NULL DEFAULT 0,
  "issues" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ(3),
  UNIQUE ("organizationId","datasetId","fileHash")
);

CREATE INDEX "education_import_batch_datasetId_status_idx" ON "education_import_batch" ("datasetId","status");

CREATE TABLE "education_record" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "datasetId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "studentId" TEXT NOT NULL DEFAULT '',
  "campusId" TEXT NOT NULL DEFAULT '',
  "courseId" TEXT NOT NULL DEFAULT '',
  "classId" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMPTZ(3),
  "relativeDay" INTEGER,
  UNIQUE ("datasetId","kind","sourceId")
);

CREATE INDEX "education_record_organizationId_datasetId_kind_idx" ON "education_record" ("organizationId","datasetId","kind");

CREATE TABLE "education_risk_proposal" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "datasetId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "scope" JSONB NOT NULL,
  "rule" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "preview" JSONB,
  "publishedTagId" UUID UNIQUE,
  "createdBy" UUID NOT NULL,
  "agentOperationKey" VARCHAR(200),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE ("organizationId","agentOperationKey")
);

CREATE INDEX "education_risk_proposal_organizationId_createdAt_idx" ON "education_risk_proposal" ("organizationId","createdAt");

CREATE TABLE "education_segment_snapshot" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "segmentId" UUID NOT NULL UNIQUE,
  "sourceTagId" UUID NOT NULL,
  "tagVersion" INTEGER NOT NULL,
  "datasetId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "payload" JSONB NOT NULL,
  "memberCount" INTEGER NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE ("organizationId","sourceTagId","tagVersion")
);

CREATE INDEX "education_segment_snapshot_organizationId_createdAt_idx" ON "education_segment_snapshot" ("organizationId","createdAt");

CREATE TABLE "knowledge_source_version" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "logicalSourceId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "kind" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "indexStatus" TEXT NOT NULL DEFAULT 'pending',
  "indexAttemptId" UUID,
  "embeddingModel" TEXT,
  "embeddingConfigFingerprint" TEXT,
  "embeddingDimensions" INTEGER,
  "period" JSONB,
  "dataCutoff" TIMESTAMPTZ(3),
  "evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "error" TEXT,
  "createdBy" UUID NOT NULL,
  "approvedBy" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "approvedAt" TIMESTAMPTZ(3),
  "indexedAt" TIMESTAMPTZ(3),
  UNIQUE ("organizationId","logicalSourceId","version")
);

CREATE INDEX "knowledge_source_version_organizationId_isCurrent_status_indexStatus_idx" ON "knowledge_source_version" ("organizationId","isCurrent","status","indexStatus");

CREATE TABLE "knowledge_chunk" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "versionId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "embedding" vector,
  "embeddingModel" TEXT NOT NULL,
  "embeddingConfigFingerprint" TEXT NOT NULL,
  "embeddingDimensions" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  UNIQUE ("versionId","ordinal")
);

CREATE INDEX "knowledge_chunk_organizationId_embeddingConfigFingerprint_embeddingDimensions_idx" ON "knowledge_chunk" ("organizationId","embeddingConfigFingerprint","embeddingDimensions");

CREATE TABLE "agent_session" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "datasetId" UUID NOT NULL,
  "scope" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX "agent_session_organizationId_updatedAt_idx" ON "agent_session" ("organizationId","updatedAt");

-- BEGIN AGENT_TASK_STATE_APPEND_ONLY: 已有数据库仅追加此区块，不重新初始化。
ALTER TABLE agent_session ADD COLUMN IF NOT EXISTS "taskState" JSONB;
-- END AGENT_TASK_STATE_APPEND_ONLY

CREATE TABLE "agent_message" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "runId" UUID,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX "agent_message_organizationId_sessionId_createdAt_idx" ON "agent_message" ("organizationId","sessionId","createdAt");

CREATE TABLE "agent_execution" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "requestKey" VARCHAR(200) NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "answer" JSONB,
  "steps" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "proposals" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  UNIQUE ("organizationId","createdBy","requestKey")
);

CREATE INDEX "agent_execution_organizationId_sessionId_startedAt_idx" ON "agent_execution" ("organizationId","sessionId","startedAt");

CREATE UNIQUE INDEX knowledge_source_version_current ON knowledge_source_version ("organizationId","logicalSourceId") WHERE "isCurrent";

ALTER TABLE knowledge_chunk ADD CONSTRAINT knowledge_chunk_dimensions CHECK (embedding IS NULL OR vector_dims(embedding)="embeddingDimensions");

ALTER TABLE knowledge_chunk ADD CONSTRAINT knowledge_chunk_version_fk FOREIGN KEY ("versionId") REFERENCES knowledge_source_version(id) ON DELETE CASCADE;

ALTER TABLE agent_message ADD CONSTRAINT agent_message_session_fk FOREIGN KEY ("sessionId") REFERENCES agent_session(id);

ALTER TABLE agent_execution ADD CONSTRAINT agent_execution_session_fk FOREIGN KEY ("sessionId") REFERENCES agent_session(id);

ALTER TABLE data_model ADD CONSTRAINT data_model_source_fk FOREIGN KEY (datasource_id) REFERENCES data_sources(id);
ALTER TABLE model_column ADD CONSTRAINT model_column_model_fk FOREIGN KEY (model_id) REFERENCES data_model(id);
ALTER TABLE education_import_batch ADD CONSTRAINT education_batch_dataset_fk FOREIGN KEY ("datasetId") REFERENCES education_dataset(id);
ALTER TABLE education_record ADD CONSTRAINT education_record_dataset_fk FOREIGN KEY ("datasetId") REFERENCES education_dataset(id);
ALTER TABLE education_record ADD CONSTRAINT education_record_batch_fk FOREIGN KEY ("batchId") REFERENCES education_import_batch(id);

-- BEGIN OPERATIONS: 新环境一次初始化；旧库由管理员备份后手动执行本区块，不自动迁移。
CREATE TABLE operational_alert (
 id UUID PRIMARY KEY,"organizationId" UUID NOT NULL,"datasetId" UUID NOT NULL REFERENCES education_dataset(id),
 "scopeKey" TEXT NOT NULL,fingerprint TEXT NOT NULL,rule TEXT NOT NULL CHECK (rule IN ('attendance_drop','low_fill','low_renewal')),
 hit JSONB NOT NULL,snapshot JSONB NOT NULL,state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','acknowledged','resolved')),
 active BOOLEAN NOT NULL DEFAULT TRUE,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),note TEXT NOT NULL DEFAULT '',
 "createdBy" UUID NOT NULL,"handledBy" UUID,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE ("organizationId","scopeKey",fingerprint,rule)
);
CREATE INDEX operational_alert_list ON operational_alert ("organizationId",active,state,"createdAt" DESC);
CREATE TABLE operational_report (
 id UUID PRIMARY KEY,"organizationId" UUID NOT NULL,"createdBy" UUID NOT NULL,"requestKey" UUID NOT NULL,"requestHash" TEXT NOT NULL,
 "datasetId" UUID NOT NULL REFERENCES education_dataset(id),kind TEXT NOT NULL CHECK(kind IN ('weekly','monthly')),
 status TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','completed','failed')),
 snapshot JSONB NOT NULL,facts JSONB NOT NULL,answer JSONB,evidence JSONB NOT NULL DEFAULT '[]',steps JSONB NOT NULL DEFAULT '[]',
 "errorMessage" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"completedAt" TIMESTAMPTZ,"deadlineAt" TIMESTAMPTZ NOT NULL,
 UNIQUE ("organizationId","createdBy","requestKey")
);
CREATE INDEX operational_report_list ON operational_report ("organizationId","createdAt" DESC);
-- END OPERATIONS
-- BEGIN DECISION_APPEND_ONLY: 已有数据库只执行本区块；不执行整份初始化文件。
ALTER TABLE education_dataset ADD COLUMN IF NOT EXISTS "analysisType" VARCHAR(20) CHECK ("analysisType" IN ('operations','learning','finance'));
CREATE TABLE IF NOT EXISTS decision_task (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL,
 "datasetId" UUID NOT NULL REFERENCES education_dataset(id),source JSONB NOT NULL,"sourceKey" TEXT NOT NULL,"sourceSnapshot" JSONB NOT NULL,
 action TEXT NOT NULL,"ownerId" UUID NOT NULL REFERENCES local_user(id),"createdBy" UUID NOT NULL REFERENCES local_user(id),
 priority VARCHAR(10) NOT NULL CHECK(priority IN ('high','normal','low')),"dueDate" VARCHAR(10) NOT NULL,"reviewMethod" TEXT NOT NULL,
 "segmentSnapshotId" UUID,"recordType" VARCHAR(20) NOT NULL CHECK("recordType" IN ('demonstration','actual')),
 state VARCHAR(20) NOT NULL CHECK(state IN ('accepted','deferred','rejected','executing','review_pending','completed')),version INTEGER NOT NULL DEFAULT 1,
 "requestKey" UUID NOT NULL,"requestHash" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE("organizationId","sourceKey"),UNIQUE("organizationId","createdBy","requestKey")
);
CREATE INDEX IF NOT EXISTS decision_task_org_state ON decision_task("organizationId",state,"updatedAt");
CREATE TABLE IF NOT EXISTS decision_feedback (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"organizationId" UUID NOT NULL,"taskId" UUID NOT NULL REFERENCES decision_task(id),
 "requestKey" UUID NOT NULL,"requestHash" TEXT NOT NULL,kind VARCHAR(20) NOT NULL CHECK(kind IN ('adoption','execution','review')),note TEXT NOT NULL,
 "reviewResult" TEXT,"adoptionIntention" VARCHAR(10) CHECK("adoptionIntention" IN ('yes','maybe','no')),"fromState" TEXT NOT NULL,"toState" TEXT NOT NULL,
 version INTEGER NOT NULL,"createdBy" UUID NOT NULL REFERENCES local_user(id),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE("organizationId","taskId","requestKey"),UNIQUE("taskId",version)
);
CREATE TABLE IF NOT EXISTS analysis_evaluation (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"organizationId" UUID NOT NULL,"createdBy" UUID NOT NULL,
 "reportId" UUID NOT NULL REFERENCES operational_report(id),"snapshotHash" TEXT NOT NULL,
 method VARCHAR(20) NOT NULL CHECK(method IN ('template','direct_model','tool_agent')),answer JSONB,
 status VARCHAR(20) NOT NULL CHECK(status IN ('completed','failed')),error TEXT,scores JSONB,"ratingNote" TEXT,
 "recordType" VARCHAR(20) NOT NULL CHECK("recordType" IN ('demonstration','actual')),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"ratedAt" TIMESTAMPTZ,"ratedBy" UUID,"ratingHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
 UNIQUE("organizationId","reportId",method)
);
-- END DECISION_APPEND_ONLY

-- BEGIN RESEARCH_APPEND_ONLY: 已有库只执行本区块，不重新初始化。
ALTER TABLE decision_task ADD COLUMN IF NOT EXISTS goals JSONB;
ALTER TABLE decision_feedback ADD COLUMN IF NOT EXISTS "quantitativeReview" JSONB;
CREATE INDEX IF NOT EXISTS analysis_evaluation_org_created ON analysis_evaluation("organizationId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS decision_feedback_org_task ON decision_feedback("organizationId","taskId",version);
-- END RESEARCH_APPEND_ONLY

COMMIT;
