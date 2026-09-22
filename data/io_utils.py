import pandas as pd
from pathlib import Path

def read_csv_with_encodings(file_path: Path) -> pd.DataFrame:
    """
    Tente de lire un fichier CSV en essayant plusieurs encodings courants (UTF-8, Latin1, etc.).
    Détecte automatiquement le séparateur (virgule ou point-virgule).
    """
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    for enc in encodings:
        try:
            # engine='python' permet d'utiliser sep=None pour la détection automatique
            return pd.read_csv(file_path, encoding=enc, sep=None, engine='python', skip_blank_lines=True)
        except Exception:
            continue
    raise RuntimeError(f"Impossible de lire le fichier {file_path} avec les encodings standards.")