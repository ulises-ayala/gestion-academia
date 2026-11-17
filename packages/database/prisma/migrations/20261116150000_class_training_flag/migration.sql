-- Decisión 277: una clase puede marcarse como formación (p. ej. Formación Docente). Lo cobrado de
-- esas clases sale en la línea "Formaciones" de la recaudación y de los cierres, aparte de "Cuotas".
-- Ninguna clase queda marcada: Administración las marca desde Clases.
ALTER TABLE "classes" ADD COLUMN "is_training" BOOLEAN NOT NULL DEFAULT false;
