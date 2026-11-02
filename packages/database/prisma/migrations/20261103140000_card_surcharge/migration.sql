-- Recargo que paga el alumno por abonar con tarjeta: un otro cobro de la academia (suma a la
-- recaudación, no a la base de liquidación del profesor).
ALTER TYPE "OtherPaymentConcept" ADD VALUE 'CARD_SURCHARGE';
