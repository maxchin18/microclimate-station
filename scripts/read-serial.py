"""Read raw serial output at common ESP8266 baud rates for diagnostics."""
import argparse
import time

import serial


parser = argparse.ArgumentParser()
parser.add_argument("port")
parser.add_argument("--seconds", type=float, default=4)
args = parser.parse_args()

for baud in (74880, 9600, 115200):
    print(f"BAUD {baud}", flush=True)
    with serial.Serial(args.port, baud, timeout=0.5) as device:
        device.dtr = False
        device.rts = False
        deadline = time.time() + args.seconds
        while time.time() < deadline:
            data = device.readline()
            if data:
                print(repr(data), flush=True)
