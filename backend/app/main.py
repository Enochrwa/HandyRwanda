from fastapi import FastAPI

from app.routers import auth

app = FastAPI(title="HandyRwanda API", version="1.0.0")

app.include_router(auth.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to HandyRwanda API"}
