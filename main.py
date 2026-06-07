from fastapi import FastAPI,WebSocket,WebSocketDisconnect,HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import psutil
import asyncio
from collections import deque
app=FastAPI()
@app.get("/")
async def get_index():
    return FileResponse("index.html")
# app.mount("/",StaticFiles(directory="."),name="static")
@app.get("/style.css")
async def  get_style():
    return FileResponse("style.css")
@app.get("/app.js")
async def get_script():
    return FileResponse("app.js")
#WebSocket for real time Data
@app.websocket("/ws")
async def websocket_endpoint(websocket:WebSocket):
    await websocket.accept()

    last_net_io=psutil.net_io_counters()
    try:
        while True:
            cpu =psutil.cpu_percent(interval=None)
            memory=psutil.virtual_memory().percent
            diskt=psutil.disk_usage('/').percent
            current_net_io=psutil.net_io_counters()
            bytes_sent=current_net_io.bytes_sent-last_net_io.bytes_sent
            bytes_received=current_net_io.bytes_recv-last_net_io.bytes_recv
            last_net_io=current_net_io
            #convert bytes to mb
            bytes_sent_mb=bytes_sent/1e6
            bytes_received_mb=bytes_received/1e6
            await websocket.send_json({
                "cpu":cpu,
                "memory":memory,
                "disk":diskt,
                "bytes_sent":bytes_sent_mb,
                "bytes_received":bytes_received_mb,
            })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
         print("Client disconnected from Websocket")
@app.get("/api/process")
async def get_processes():
    processes=[]
    for proc in psutil.process_iter(['pid','name','cpu_percent','memory_info']):
        try:
            info=proc.info
            if info['cpu_percent'] is None:
                info['cpu_percent']=0.0
            if info['memory_percent'] is None:
                info['memory_percent']=0.0
            processes.append(info)
        except(psutil.NoSuchProcess,psutil.AccessDenied,psutil.ZombieProcess) as e:
            print(f"Error getting process info: {e}")
            continue
    return processes   
@app.post("/api/processes/kill/{pid}")
async def kill_process(pid:int):
    try:
        proc=psutil.Process(pid)
        proc.terminate()
        return {"status": "success", "message": f"Process {pid} terminated"}
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process not found")
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail="Permission denied to kill this process")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))