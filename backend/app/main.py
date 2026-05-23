from fastapi import FastAPI

app = FastAPI(title="HandyRwanda API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Welcome to HandyRwanda API"}
