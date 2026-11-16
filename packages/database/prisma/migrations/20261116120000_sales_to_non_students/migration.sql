-- Ventas a quien no es alumno: entradas, precintos, indumentaria y demás conceptos del catálogo
-- se cobran sin ficha de alumno, igual que la clase suelta del alumno eventual. El pago guarda el
-- nombre del comprador (o "Público general"); el recargo por tarjeta de esa venta tampoco lleva
-- alumno. Las cuotas siguen exigiendo alumno. No toca datos existentes.
ALTER TABLE "payments" DROP CONSTRAINT "payments_payer_check";

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_payer_check" CHECK (
    ("student_id" IS NOT NULL AND "walk_in_name" IS NULL AND "walk_in_phone" IS NULL AND "walk_in_dni" IS NULL)
    OR ("student_id" IS NULL AND "walk_in_name" IS NOT NULL AND "kind" = 'OTHER')
  );
