from pydantic import BaseModel

import app

class PostRequestFromClient(BaseModel):
    id: int

class PostAnswerFromServer(BaseModel):
    text: str

@app.app.get("/")
def readPost(request: PostRequestFromClient):
    pass