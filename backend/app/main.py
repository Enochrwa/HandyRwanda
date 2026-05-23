from fastapi import FastAPI

from app.routers import auth, artisans, admin, jobs, bids

app = FastAPI(title="HandyRwanda API", version="1.0.0")

app.include_router(auth.router)
app.include_router(artisans.router)
app.include_router(admin.router)
app.include_router(jobs.router)
app.include_router(bids.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to HandyRwanda API"}
