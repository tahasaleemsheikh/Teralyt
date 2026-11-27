
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Teralyt API",
    version="1.0.0",
    description="Backend API for Teralyt authentication and application services.",
)

# Allow the local frontend and the deployed GitHub Pages frontend.
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://tahasaleemsheikh.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
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
