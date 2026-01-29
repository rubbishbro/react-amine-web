from sqlmodel import SQLModel, create_engine
import post

DATABASE_URL = "postgresql://postgres:12345678@localhost/postgres"#postgresql://username:password@localhost/dbname
engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
