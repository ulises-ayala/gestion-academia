-- Cierres semanales y mensuales de la recaudación (PO, 03/11/2026): quedan guardados como una
-- foto con los importes de ese momento; las correcciones posteriores se ven aparte, comparando la
-- foto con lo que hay hoy. Append-only: un cierre no se edita ni se borra.
CREATE TYPE "ClosingKind" AS ENUM ('WEEKLY', 'MONTHLY');

CREATE TABLE "collection_closings" (
    "id" UUID NOT NULL,
    "kind" "ClosingKind" NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_closings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collection_closings_range_valid" CHECK ("to_date" >= "from_date")
);

CREATE UNIQUE INDEX "collection_closings_kind_from_date_key"
  ON "collection_closings"("kind", "from_date");
CREATE INDEX "collection_closings_kind_to_date_idx" ON "collection_closings"("kind", "to_date");

ALTER TABLE "collection_closings"
  ADD CONSTRAINT "collection_closings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id")
  REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
