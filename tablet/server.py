"""Static server for the tablet pricing guide: serves this folder on http://127.0.0.1:8767 (the page reads only local files, so no API is needed).

Run start.bat (or `python server.py`) and open http://127.0.0.1:8767/tablet_sim.html. The page does not work when opened as a file, because it loads
its data with fetch()."""
import http.server
import os
import socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8767"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def do_GET(self):
        if self.path == "/api/ping":
            raw = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as s:
        print("Tablet pricing guide on http://127.0.0.1:%d/tablet_sim.html (Ctrl+C to stop)" % PORT)
        s.serve_forever()
