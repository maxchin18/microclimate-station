"""Local-only DHT monitor. No sample values are generated."""
import argparse
import json
import math
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import serial
from serial.tools import list_ports

ROOT = Path(__file__).resolve().parent
PAUSE = ROOT / '.runtime' / 'uploading'
lock = threading.Lock()
history = deque(maxlen=1440)
state = {'status': 'waiting', 'message': '等待 USB 傳輸線連接開發板', 'port': None, 'latest': None, 'ports': []}

def update(**values):
    with lock:
        state.update(values)

def valid_sample(data):
    return (isinstance(data, dict) and data.get('ok') is True and
            all(type(data.get(k)) in (int, float) and math.isfinite(data[k]) for k in ('temperature', 'humidity')) and
            -40 <= data['temperature'] <= 125 and 0 <= data['humidity'] <= 100)

def reader(explicit_port=None):
    while True:
        if PAUSE.exists():
            update(status='paused', message='正在上傳韌體，暫停讀取', port=None)
            time.sleep(0.5)
            continue
        ports = list(list_ports.comports())
        candidates = [p.device for p in ports if p.vid in (0x1A86, 0x10C4, 0x0403)]
        update(ports=[{'device': p.device, 'description': p.description} for p in ports])
        port = explicit_port or (candidates[0] if len(candidates) == 1 else None)
        if not port:
            update(status='waiting', port=None, message='找到多個 USB 串列裝置，請以 --port COM號碼 啟動' if len(candidates) > 1 else '等待 USB 傳輸線連接開發板')
            time.sleep(2)
            continue
        try:
            update(status='connecting', port=port, message='已開啟連接埠，等待感應器資料')
            with serial.Serial(port, 115200, timeout=1) as device:
                # Some CH340 NodeMCU boards stay in reset while both modem-control
                # lines are asserted by pyserial's defaults. Release them after open.
                device.dtr = False
                device.rts = False
                last_received = time.monotonic()
                while not PAUSE.exists():
                    raw = device.readline(2048)
                    try:
                        data = json.loads(raw.decode('utf-8', errors='replace'))
                    except (ValueError, UnicodeError):
                        data = None
                    if valid_sample(data):
                        sample = {'timestamp': time.time(), 'temperature': data['temperature'], 'humidity': data['humidity']}
                        with lock:
                            history.append(sample)
                            state.update(status='live', message='即時接收中 · 每 2.5 秒更新', latest=sample)
                        last_received = time.monotonic()
                    elif isinstance(data, dict) and data.get('error') == 'DHT_READ_FAILED':
                        update(status='sensor_error', message='感應器讀取失敗，請檢查 D5、3V3、GND 接線')
                        last_received = time.monotonic()
                    elif time.monotonic() - last_received > 10:
                        update(status='stale', message='尚未收到有效讀值，請先上傳本專案韌體或檢查接線')
        except (serial.SerialException, OSError) as exc:
            update(status='disconnected', port=None, message=f'USB 未連接或連接埠被占用，將自動重試：{exc}')
            time.sleep(2)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/state':
            with lock:
                body = json.dumps({**state, 'history': list(history)}, ensure_ascii=False).encode('utf-8')
            mime = 'application/json; charset=utf-8'
        elif self.path in ('/', '/index.html'):
            body = (ROOT / 'web' / 'index.html').read_bytes()
            mime = 'text/html; charset=utf-8'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', help='Serial port, for example COM3')
    parser.add_argument('--http-port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.http_port), Handler)
    threading.Thread(target=reader, args=(args.port,), daemon=True).start()
    print(f'DHT monitor: http://127.0.0.1:{args.http_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
