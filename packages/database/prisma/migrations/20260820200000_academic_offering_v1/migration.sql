CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

CREATE TABLE "dance_types" (
  "id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL, "normalized_name" VARCHAR(100) NOT NULL,
  "description" TEXT, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dance_types_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "branches" (
  "id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL, "address" TEXT NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "rooms" (
  "id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL, "capacity" INTEGER NOT NULL, "branch_id" UUID NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "classes" (
  "id" UUID NOT NULL, "name" VARCHAR(150) NOT NULL, "dance_type_id" UUID NOT NULL, "teacher_id" UUID NOT NULL,
  "level" VARCHAR(100), "capacity" INTEGER NOT NULL, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "class_schedules" (
  "id" UUID NOT NULL, "class_id" UUID NOT NULL, "day_of_week" "DayOfWeek" NOT NULL,
  "start_time" TIME(0) NOT NULL, "end_time" TIME(0) NOT NULL, "room_id" UUID NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_schedules_time_order_check" CHECK ("end_time" > "start_time")
);

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_capacity_positive_check" CHECK ("capacity" > 0);
ALTER TABLE "classes" ADD CONSTRAINT "classes_capacity_positive_check" CHECK ("capacity" > 0);
CREATE UNIQUE INDEX "dance_types_normalized_name_key" ON "dance_types"("normalized_name");
CREATE INDEX "dance_types_name_idx" ON "dance_types"("name");
CREATE INDEX "branches_name_idx" ON "branches"("name");
CREATE INDEX "rooms_branch_id_status_idx" ON "rooms"("branch_id", "status");
CREATE INDEX "rooms_name_idx" ON "rooms"("name");
CREATE INDEX "classes_dance_type_id_status_idx" ON "classes"("dance_type_id", "status");
CREATE INDEX "classes_teacher_id_status_idx" ON "classes"("teacher_id", "status");
CREATE INDEX "classes_name_idx" ON "classes"("name");
CREATE INDEX "class_schedules_class_id_status_idx" ON "class_schedules"("class_id", "status");
CREATE INDEX "class_schedules_room_id_day_of_week_status_start_time_end_time_idx" ON "class_schedules"("room_id", "day_of_week", "status", "start_time", "end_time");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_dance_type_id_fkey" FOREIGN KEY ("dance_type_id") REFERENCES "dance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
