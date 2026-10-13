"""Sirve esta carpeta y expone /api/games con los .html que haya en ella.
Local:  python server.py   ->  http://localhost:8000
Render: Start Command  ->  uvicorn server:app --host 0.0.0.0 --port $PORT
"""
import os
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

BASE = Path(__file__).resolve().parent
app = FastAPI()


@app.get("/api/games")
def games():
    files = [
        f.name
        for f in BASE.iterdir()
        if f.is_file()
        and f.suffix.lower() in (".html", ".htm")
        and not re.match(r"^(index\.html?$|_)", f.name, re.I)
    ]
    return sorted(files, key=str.lower)


# Debe ir al final: sirve index.html y los juegos
app.mount("/", StaticFiles(directory=BASE, html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
