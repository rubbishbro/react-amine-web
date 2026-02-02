import sys
import os

# Ensure we can import app modules
sys.path.append(os.getcwd())
print(f"CWD: {os.getcwd()}")
print(f"Env file exists: {os.path.exists('.env')}")
if os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        print("First 5 lines of .env:")
        print(f.read(200)) # Read first 200 chars

try:
    from app.core.config import settings
    # print(settings.model_dump())

    print(f"User: {settings.POSTGRES_USER}")
    print(f"Server: {settings.POSTGRES_SERVER}")
    # print(f"Port: {settings.POSTGRES_PORT}")
    print(f"DB: {settings.POSTGRES_DB}")
    print(f"Password being used: '{settings.POSTGRES_PASSWORD}'") 
    print(f"Full URI: {settings.SQLALCHEMY_DATABASE_URI}")

    from sqlalchemy import create_engine
    from sqlalchemy.exc import OperationalError

    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    
    print("\nAttempting to connect to database...")
    with engine.connect() as connection:
        print("Successfully connected to the database!")
        
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
