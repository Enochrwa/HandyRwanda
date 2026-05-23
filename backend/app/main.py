from fastapi import FastAPI

app = FastAPI(title="HandyRwanda API", version="1.0.0")


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to HandyRwanda API"}
