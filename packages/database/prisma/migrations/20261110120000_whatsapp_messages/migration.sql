-- Mensajes de WhatsApp predeterminados por situación del alumno o del potencial alumno, editables
-- por Administración y Dirección, y el registro de a quién se le envió cada uno.
CREATE TYPE "MessageSituation" AS ENUM (
  'CHARGE_DUE_SOON',
  'CHARGE_OVERDUE',
  'ABSENCES',
  'DROPPED',
  'WELCOME',
  'BIRTHDAY',
  'LEAD_NO_TRIAL',
  'LEAD_TRIAL_NOT_ENROLLED'
);

CREATE TABLE "message_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "situation" "MessageSituation" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_templates_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "message_templates_body_not_blank" CHECK (length(btrim("body")) > 0)
);

CREATE INDEX "message_templates_situation_status_idx" ON "message_templates"("situation", "status");

-- Registro de envíos: quién abrió WhatsApp con qué mensaje y para quién. No se edita ni se borra.
CREATE TABLE "message_sends" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "situation" "MessageSituation" NOT NULL,
    "template_id" UUID,
    "student_id" UUID,
    "lead_id" UUID,
    "body" TEXT NOT NULL,
    "sent_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_sends_pkey" PRIMARY KEY ("id"),
    -- El destinatario es un alumno o un potencial alumno, nunca los dos.
    CONSTRAINT "message_sends_recipient_check" CHECK (("student_id" IS NULL) <> ("lead_id" IS NULL))
);

CREATE INDEX "message_sends_situation_created_at_idx" ON "message_sends"("situation", "created_at" DESC);
CREATE INDEX "message_sends_student_id_idx" ON "message_sends"("student_id");
CREATE INDEX "message_sends_lead_id_idx" ON "message_sends"("lead_id");

ALTER TABLE "message_sends"
  ADD CONSTRAINT "message_sends_template_id_fkey" FOREIGN KEY ("template_id")
  REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_sends"
  ADD CONSTRAINT "message_sends_student_id_fkey" FOREIGN KEY ("student_id")
  REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_sends"
  ADD CONSTRAINT "message_sends_lead_id_fkey" FOREIGN KEY ("lead_id")
  REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_sends"
  ADD CONSTRAINT "message_sends_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id")
  REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mensajes iniciales. Lo que va entre llaves se completa con los datos de cada destinatario.
INSERT INTO "message_templates" ("situation", "name", "body", "sort_order") VALUES
  ('CHARGE_DUE_SOON', 'Recordatorio de vencimiento', E'Hola {nombre} 👋💃\nTe recordamos desde *Carmesí* que el {vencimiento} vence tu cuota ({cuotas}, {saldo}).\n\nPodés abonar en la academia o por transferencia 🙌\n¡Gracias! ❤️', 10),
  ('CHARGE_OVERDUE', 'Recordatorio amable', E'Hola {nombre} 👋💃\nTe escribimos de *Carmesí*. Nos figura pendiente {cuotas} por {saldo_vencido} (la más antigua venció el {vencimiento}).\n\nPodés abonar en la academia o por transferencia 🙌\nSi ya pagaste, avisanos y lo revisamos. ¡Gracias! ❤️', 10),
  ('CHARGE_OVERDUE', 'Segundo aviso', E'Hola {nombre} 🙂\nTe escribimos nuevamente de *Carmesí* por {cuotas} pendientes: {saldo_vencido}, vencidas desde el {vencimiento}.\n\n¿Nos contás cuándo podrías regularizarlo? Si necesitás acordar una forma de pago, lo vemos juntas 🤝', 20),
  ('ABSENCES', 'Te extrañamos', E'Hola {nombre} 💃✨\nNotamos que faltaste a las últimas clases de {clase} y te extrañamos en la pista.\n\n¿Está todo bien? Contanos si podemos ayudarte en algo ❤️', 10),
  ('DROPPED', 'Volvé cuando quieras', E'Hola {nombre} 🌹\nTe escribimos de *Carmesí*. Nos quedamos con ganas de seguir bailando con vos en {clase}.\n\nCuando quieras volver, tenés tu lugar 💃 ¿Te contamos los horarios de este mes?', 10),
  ('WELCOME', 'Bienvenida', E'¡Hola {nombre}! 🎉💃\nTe damos la bienvenida a *Carmesí*. Qué lindo tenerte en {clase}.\n\nCualquier duda con horarios o pagos, escribinos por acá. ¡Nos vemos en clase! ❤️', 10),
  ('BIRTHDAY', 'Feliz cumpleaños', E'¡Feliz cumple, {nombre}! 🎂🎉\nToda la familia de *Carmesí* te desea un día hermoso y un año lleno de baile 💃❤️', 10),
  ('LEAD_NO_TRIAL', 'Invitación a la clase de prueba', E'Hola {nombre} 👋\nTe escribimos de *Carmesí* 💃 Hace unos días nos consultaste por las clases.\n\nLa primera clase de prueba es gratis: ¿te reservamos un lugar esta semana? ✨', 10),
  ('LEAD_TRIAL_NOT_ENROLLED', 'Después de la clase de prueba', E'Hola {nombre} 💃\n¿Qué te pareció la clase de prueba de {clase}? Nos encantó tenerte.\n\nSi querés sumarte, te contamos las modalidades y los horarios 🙌', 10);
