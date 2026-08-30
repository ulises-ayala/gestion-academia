CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'IN_PERSON');
CREATE TYPE "LeadStatus" AS ENUM ('INQUIRY', 'INTERESTED', 'TRIAL', 'ENROLLED', 'NOT_CONVERTED');

CREATE TABLE "leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(80),
    "normalized_phone" VARCHAR(50),
    "email" VARCHAR(254),
    "normalized_email" VARCHAR(254),
    "instagram" VARCHAR(100),
    "normalized_instagram" VARCHAR(100),
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'INQUIRY',
    "notes" TEXT,
    "next_follow_up_at" TIMESTAMPTZ(3),
    "last_contact_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_name_idx" ON "leads"("name");
CREATE INDEX "leads_status_updated_at_idx" ON "leads"("status", "updated_at" DESC);
CREATE INDEX "leads_source_updated_at_idx" ON "leads"("source", "updated_at" DESC);
CREATE INDEX "leads_next_follow_up_at_idx" ON "leads"("next_follow_up_at");
CREATE INDEX "leads_normalized_phone_idx" ON "leads"("normalized_phone");
CREATE INDEX "leads_normalized_email_idx" ON "leads"("normalized_email");
CREATE INDEX "leads_normalized_instagram_idx" ON "leads"("normalized_instagram");
