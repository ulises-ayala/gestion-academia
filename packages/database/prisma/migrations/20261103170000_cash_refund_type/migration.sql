-- Devolución de saldo a favor: un egreso de la caja del turno de quien devuelve. Va en una
-- migración propia porque un valor nuevo de enum no se puede usar en la misma transacción.
ALTER TYPE "CashMovementType" ADD VALUE 'REFUND';
