"""
Friendly startup for Garage Ledger.

  - checks whether Garage Ledger is already running, and if so just opens
    your browser to it instead of crashing with a "port already in use"
    error
  - otherwise starts the server and opens your browser automatically once
    it's ready
  - its error friendly
"""
import sys
import time
import threading
import webbrowser
import urllib.request

HOST = "127.0.0.1"
PORT = 8000
APP_URL = f"http://{HOST}:{PORT}/app/"
HEALTH_URL = f"http://{HOST}:{PORT}/health"


def already_running() -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False


def open_browser_once_ready() -> None:
    # Polls in the background while the server starts, then opens the
    # browser the moment it responds (up to ~15 seconds), so the person
    # never has to guess when it's ready.
    for _ in range(60):
        if already_running():
            webbrowser.open(APP_URL)
            return
        time.sleep(0.25)
    webbrowser.open(APP_URL)  # open anyway after the timeout, just in case


def main() -> None:
    print("Garage Ledger")
    print("=============\n")

    if already_running():
        print("Garage Ledger is already running — opening it in your browser.")
        webbrowser.open(APP_URL)
        input("\nYou can close this window.\n")
        return

    print("Starting Garage Ledger...")
    print("Keep this window open while you use the app.")
    print("Close it whenever you want to stop Garage Ledger.\n")

    threading.Thread(target=open_browser_once_ready, daemon=True).start()

    import uvicorn
    try:
        uvicorn.run("backend.main:app", host=HOST, port=PORT, log_level="warning")
    except OSError:
        print(f"\nCouldn't start Garage Ledger: something else on this computer")
        print(f"is already using port {PORT}.")
        print("Close that other program (or restart your computer) and try again.")
    except KeyboardInterrupt:
        pass

    print("\nGarage Ledger has stopped.")
    input("Press Enter to close this window.")


if __name__ == "__main__":
    main()
