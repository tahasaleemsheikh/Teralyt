
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import Base, engine
from app import models
from app.database import engine
from app import models
from app.database import Base, engine
from app.routes.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
# Create database tables for local development.
Base.metadata.create_all(bind=engine)
app = FastAPI(
    title="Teralyt API",
    version="1.0.0",
    description="Backend API for Teralyt authentication and application services.",
)
# Register authentication endpoints.
app.include_router(auth_router)
# Allow the local frontend and the deployed GitHub Pages frontend.

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://tahasaleemsheikh.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {
        "message": "Welcome to Teralyt API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "teralyt-api",
    }


@app.get("/health/db")
def database_health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "connected",
        "database": "teralyt_db",
    }
