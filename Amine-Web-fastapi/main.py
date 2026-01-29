import sys
import os
sys.path.append("D:/wz/react-amine-web/Amine-Web-fastapi/")#fastapi目录
from fastapi import FastAPI

from Log import log

app=FastAPI()
log.LOG_DIR="D:/wz/react-amine-web/Amine-Web-fastapi/.log"#日志路径
log.init()

@app.get("/")
def read_root():
    log.print_log(log.LOG_INFO,"test1")
    log.print_log(log.LOG_WARNING,"test2")
    return {"Hello":"World"}