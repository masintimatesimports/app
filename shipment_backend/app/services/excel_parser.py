import pandas as pd
from io import BytesIO  # ADD THIS
import warnings  # ADD THIS

def read_excel(file_bytes, sheet_name):
    warnings.filterwarnings('ignore', category=FutureWarning)  # ADD THIS
    warnings.filterwarnings('ignore', category=UserWarning)  # ADD THIS
    return pd.read_excel(BytesIO(file_bytes), sheet_name=sheet_name)  # CHANGE THIS