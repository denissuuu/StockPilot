CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "resourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_organizationId_operation_key_key"
ON "IdempotencyKey"("organizationId", "operation", "key");

CREATE INDEX "IdempotencyKey_organizationId_createdAt_idx"
ON "IdempotencyKey"("organizationId", "createdAt");

ALTER TABLE "IdempotencyKey"
ADD CONSTRAINT "IdempotencyKey_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
