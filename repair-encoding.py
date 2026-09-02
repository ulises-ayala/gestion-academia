from pathlib import Path

SOURCE = Path(
    "backup_academia_completa_2026-08-28_utf8.sql"
)

DESTINATION = Path(
    "backup_academia_completa_2026-08-28_reparado.sql"
)

text = SOURCE.read_text(
    encoding="utf-8"
)

try:
    repaired = (
        text
        .encode("cp437")
        .decode("utf-8")
    )
except UnicodeError as error:
    print("No se pudo convertir todo el archivo de una vez.")
    print(error)
    raise

DESTINATION.write_text(
    repaired,
    encoding="utf-8",
    newline="",
)

print(
    f"Archivo reparado: {DESTINATION}"
)