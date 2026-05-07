import yfinance as yf
import pandas as pd
import json
import os
import time

TICKERS = [
    {"symbol": "^GSPC",            "file": "GSPC"},
    {"symbol": "^SP500TR",         "file": "SP500TR"},
    {"symbol": "^IXIC",            "file": "IXIC"},
    {"symbol": "^990100-USD-STRD", "file": "MSCI_WORLD"},
    {"symbol": "^892400-USD-STRD", "file": "MSCI_ACWI"},
    {"symbol": "^SSMI",            "file": "SSMI"},
    {"symbol": "SMIM.SW",          "file": "SMIM.SW"},
    {"symbol": "XS2D.L",           "file": "XS2D.L"},
]

os.makedirs("data", exist_ok=True)

for t in TICKERS:
    try:
        df = yf.download(t["symbol"], period="max", auto_adjust=True, progress=False)
        if df.empty:
            print(f"SKIP {t['symbol']}: no data returned")
            continue

        close = df["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]

        dates = df.index.strftime("%Y-%m-%d").tolist()
        closes = [round(float(v), 4) if v == v else None for v in close]

        path = f"data/{t['file']}.json"
        with open(path, "w") as f:
            json.dump({"dates": dates, "closes": closes}, f, separators=(",", ":"))

        print(f"OK {t['symbol']}: {len(dates)} rows -> {path}")
        time.sleep(1)
    except Exception as e:
        print(f"ERROR {t['symbol']}: {e}")
