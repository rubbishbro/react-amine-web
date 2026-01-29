import time
import os

#日志类型
LOG_INFO=0
LOG_WARNING=1
LOG_ERROR=2

LOG_FILENAME=""#日志文件名
LOG_DEBUG=True#是否为调试模式（如果为True则在终端中输出日志）
LOG_DIR=""#日志位置
class log_time:#时间
    year=0
    month=0
    day=0
    hour=0
    minute=0
    second=0
    def __init__(self,l:time.struct_time):
        self.year=l.tm_year
        self.month=l.tm_mon
        self.day=l.tm_mday
        self.hour=l.tm_hour
        self.minute=l.tm_min
        self.second=l.tm_sec
    def print_time(self):#输出时间
        print("now the time is %d-%d-%d %d:%d:%d",self.year,self.month,self.day,self.hour,self.minute,self.second)
def init():#日志初始化
    global LOG_FILENAME
    retval = os.getcwd()
    os.chdir(LOG_DIR)
    rq=time.localtime()
    t=log_time(rq)
    t.print_time()
    LOG_FILENAME="fastapi_%d_%d_%d_%d_%d_%d.log"%(t.year,t.month,t.day,t.hour,t.minute,t.second)#"../.log/"+
    print("log is in "+LOG_FILENAME)
    file=open(LOG_FILENAME,mode="w")
    file.close()
    os.chdir(retval)
def print_log(type:int,text:str):#输出日志
    retval = os.getcwd()
    os.chdir(LOG_DIR)
    file=open(LOG_FILENAME,mode="a+")
    lstr=""
    if type==LOG_INFO:
        lstr+="[Fastapi:INFO]"
    elif type==LOG_WARNING:
        lstr+="[Fastapi:WARNING]"
    else:
        lstr+="[Fastapi:ERROR]"
    lstr+=text
    file.write(lstr+'\n')
    if LOG_DEBUG:
        print(lstr)
    file.close()
    os.chdir(retval)