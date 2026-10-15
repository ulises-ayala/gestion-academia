/*
  Warnings:

  - Added the required column `class_id` to the `tariffs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."tariffs" ADD COLUMN     "class_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "tariffs_class_id_valid_from_valid_to_idx" ON "public"."tariffs"("class_id", "valid_from", "valid_to");

-- AddForeignKey
ALTER TABLE "public"."tariffs" ADD CONSTRAINT "tariffs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
