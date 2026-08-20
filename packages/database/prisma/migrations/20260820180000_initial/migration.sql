CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "dni" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "birth_date" DATE,
    "phone" VARCHAR(50),
    "email" VARCHAR(254),
    "address" TEXT,
    "joined_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "dni" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(254),
    "address" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "students_dni_key" ON "students"("dni");
CREATE INDEX "students_last_name_first_name_idx" ON "students"("last_name", "first_name");
CREATE UNIQUE INDEX "teachers_dni_key" ON "teachers"("dni");
CREATE INDEX "teachers_last_name_first_name_idx" ON "teachers"("last_name", "first_name");
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");
