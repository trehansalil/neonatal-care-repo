from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.routers import auth, babies, logs, growth, routine, telegram

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="neonate.care API",
    description="Backend for the Neonate Care parenting tracker",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(babies.router)
app.include_router(logs.router)
app.include_router(growth.router)
app.include_router(routine.router)
app.include_router(telegram.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "neonate.care"}
