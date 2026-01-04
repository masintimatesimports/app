import pandas as pd

def read_excel(file_bytes, sheet_name):
    return pd.read_excel(file_bytes, sheet_name=sheet_name)
