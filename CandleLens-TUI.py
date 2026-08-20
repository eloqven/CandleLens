#!/usr/bin/env python3
"""CandleLens launcher TUI (Windows, stdlib only)."""
import os
import sys
import time
import subprocess

REPO = r"D:\CandlLens"
SERVER = os.path.join(REPO, "server")
API_PORT = 8000
DASH_PORT = 5173

SYMBOL = "BTCUSDT"
SYN_N = 2000
FETCH_MONTHS = 48

NEW_CONSOLE = 0x00000010  # CREATE_NEW_CONSOLE


def clear():
    os.system("cls")


def port_listening(port):
    try:
        out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return False
    for line in out.splitlines():
        if f":{port} " in line and "LISTENING" in line:
            return True
    return False


def kill_port(port):
    try:
        out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return
    pids = set()
    for line in out.splitlines():
        if f":{port} " in line and "LISTENING" in line:
            pids.add(line.split()[-1])
    for pid in pids:
        subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True)


def start_api(mode):
    kill_port(API_PORT)
    if mode == "synthetic":
        inner = f'cd /d {SERVER} && python api.py --seed-synthetic {SYMBOL} --seed-n {SYN_N} --serve --port {API_PORT}'
    else:
        inner = f'cd /d {SERVER} && python api.py --fetch {SYMBOL} --fetch-months {FETCH_MONTHS} --serve --port {API_PORT}'
    subprocess.Popen(["cmd", "/k", inner], creationflags=NEW_CONSOLE)


def start_dash():
    kill_port(DASH_PORT)
    inner = f'cd /d {REPO} && npm run dev'
    subprocess.Popen(["cmd", "/k", inner], creationflags=NEW_CONSOLE)


def stop_all():
    kill_port(API_PORT)
    kill_port(DASH_PORT)


def status_line():
    a = "RUNNING" if port_listening(API_PORT) else "STOPPED"
    d = "RUNNING" if port_listening(DASH_PORT) else "STOPPED"
    return f"  API (:{API_PORT})      [{a}]\n  Dashboard (:5173)   [{d}]"


def settings_menu():
    global SYMBOL, SYN_N, FETCH_MONTHS
    while True:
        clear()
        print("== Settings ==")
        print(f"  1) Symbol            : {SYMBOL}")
        print(f"  2) Synthetic candles : {SYN_N}")
        print(f"  3) Fetch months      : {FETCH_MONTHS}")
        print("  4) Back")
        print()
        c = input("Setting [1-4]: ").strip()
        if c == "1":
            v = input("New symbol: ").strip().upper()
            if v:
                SYMBOL = v
        elif c == "2":
            v = input("New synthetic candle count: ").strip()
            if v.isdigit():
                SYN_N = int(v)
        elif c == "3":
            v = input("New fetch months: ").strip()
            if v.isdigit():
                FETCH_MONTHS = int(v)
        elif c == "4":
            return


def main():
    while True:
        clear()
        print("  CandleLens Launcher TUI")
        print("  =======================")
        print()
        print(status_line())
        print()
        print("  1) Start / Restart - SYNTHETIC data (seed, fast)")
        print("  2) Start / Restart - REAL Binance fetch (slower)")
        print("  3) Stop servers")
        print("  4) Settings")
        print("  5) Exit")
        print()
        c = input("Choice [1-5]: ").strip()
        if c == "1":
            start_api("synthetic")
            start_dash()
            print("\nLaunching synthetic mode... (API + dashboard windows open)")
            time.sleep(2)
        elif c == "2":
            start_api("real")
            start_dash()
            print("\nLaunching real fetch (may take a while to ingest)...")
            time.sleep(2)
        elif c == "3":
            stop_all()
            print("\nStopped. Ports released.")
            time.sleep(1.5)
        elif c == "4":
            settings_menu()
        elif c == "5":
            print("Bye.")
            sys.exit(0)
        else:
            print("Invalid choice.")
            time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
