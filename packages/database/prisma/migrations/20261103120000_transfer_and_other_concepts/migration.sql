-- Transferencia bancaria como medio de pago, distinta de Mercado Pago.
ALTER TYPE "PaymentMethod" ADD VALUE 'TRANSFER';

-- Conceptos fijos de los otros cobros, para la recaudación por concepto: indumentaria y
-- precintos de la Gala (además de clase suelta y "Otro" con detalle).
ALTER TYPE "OtherPaymentConcept" ADD VALUE 'APPAREL';
ALTER TYPE "OtherPaymentConcept" ADD VALUE 'GALA_SEAL';
