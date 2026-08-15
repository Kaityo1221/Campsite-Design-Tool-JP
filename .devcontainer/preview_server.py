from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 4173

class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ('/', ''):
            self.send_response(302)
            self.send_header('Location', '/field-mode.html')
            self.end_headers()
            return
        super().do_GET()

if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), PreviewHandler)
    print(f'CREATIVE MODE preview: http://0.0.0.0:{PORT}/field-mode.html', flush=True)
    server.serve_forever()
