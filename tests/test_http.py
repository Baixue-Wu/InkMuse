import http.client
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from server.__main__ import App, make_handler


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        (root / 'index.html').write_text('InkMuse')
        self.app = App({'web_root': root, 'asset_dir': root / 'assets'})
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.app))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def call(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        status, data = response.status, response.read()
        conn.close()
        return status, data

    def test_client_and_status_are_served(self):
        self.assertEqual(self.call('GET', '/'), (200, b'InkMuse'))
        status, data = self.call('GET', '/api/status')
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(data)['generation'])

    def test_traversal_and_non_image_assets_are_blocked(self):
        self.assertEqual(self.call('GET', '/%2e%2e/config.example.json')[0], 403)
        self.assertEqual(self.call('GET', '/assets/../config.example.json')[0], 404)

    def test_bad_requests_fail_without_designing(self):
        self.assertEqual(self.call('POST', '/api/design', '{"text":""}')[0], 400)
        self.assertEqual(self.call('POST', '/api/design', 'not json')[0], 400)
        self.assertEqual(self.call('POST', '/api/design', '{}', {'Origin': 'https://external.invalid'})[0], 403)


if __name__ == '__main__':
    unittest.main()
