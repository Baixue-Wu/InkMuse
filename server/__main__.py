"""Run the InkMuse HTTP service."""
import argparse
import concurrent.futures
import json
import mimetypes
import re
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .providers import Images, choose_images, design_text


class App:
    def __init__(self, config):
        self.config = config
        self.web_root = Path(config['web_root']).resolve()
        self.images = Images(config['asset_dir'], config.get('images', {}))
        self.design_slots = threading.BoundedSemaphore(2)

    def design(self, data):
        text = data.get('text', '')
        if not isinstance(text, str) or not 10 <= len(text.strip()) <= 12000:
            raise ValueError('请提供 10 至 12000 字的文字。')
        if data.get('mode', 'polish') not in ('polish', 'preserve'):
            raise ValueError('文字处理方式无效。')
        if not self.design_slots.acquire(blocking=False):
            raise ValueError('正在处理其他设计，请稍后重试。')
        try:
            plan = design_text(text, data.get('mood', 'auto'), data.get('mode', 'polish'), self.config.get('text', {}))
            warnings = []
            if data.get('pictures', True):
                queries = list(dict.fromkeys(p.get('imageQuery') for p in plan['pages'] if p.get('imageQuery')))[:4]
                def find(query):
                    try:
                        choices = self.images.search(query)
                        if not choices:
                            return query, None, f'“{query}”未找到可用配图，可在编辑器中换关键词。'
                        return query, choices, None
                    except (ValueError, RuntimeError, OSError) as exc:
                        return query, None, str(exc)
                with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                    matches = list(pool.map(find, queries))
                groups = {query: candidates for query, candidates, warning in matches if candidates}
                try:
                    selected = choose_images(groups, self.config.get('text', {})) if groups else {}
                except (ValueError, RuntimeError, OSError) as exc:
                    selected = {}
                    warnings.append(str(exc))
                for query, candidates, warning in matches:
                    if warning:
                        warnings.append(warning)
                    image = None
                    if query in selected:
                        try:
                            image = self.images.select(selected[query])
                        except (ValueError, RuntimeError, OSError) as exc:
                            warnings.append(str(exc))
                    elif candidates:
                        warnings.append(f'“{query}”没有足够匹配的候选，保留插画。可以手动搜索或上传。')
                    for page in plan['pages']:
                        if page.get('imageQuery') == query:
                            page['image'] = image
            return {'plan': plan, 'warnings': warnings, 'origin': 'ai'}
        finally:
            self.design_slots.release()


def make_handler(app):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            print(f'{self.command} {urllib.parse.urlparse(self.path).path} {args[1] if len(args) > 1 else ""}', flush=True)

        def respond(self, status, data, content_type='application/json; charset=utf-8'):
            content = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cache-Control', 'no-store' if content_type.startswith('application/json') else 'no-cache')
            self.end_headers()
            try:
                self.wfile.write(content)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
            if path == '/api/status':
                return self.respond(200, {'name': 'InkMuse', 'text': app.config.get('text', {}).get('provider'),
                                         'search': True, 'generation': bool(app.config.get('generation'))})
            if path.startswith('/assets/'):
                name = path.removeprefix('/assets/')
                if not re.fullmatch(r'[a-f0-9]{64}\.(png|jpg|webp)', name):
                    return self.respond(404, {'error': '图片不存在。'})
                file = app.images.directory / name
            else:
                file = (app.web_root / (path.lstrip('/') or 'index.html')).resolve()
                if not file.is_relative_to(app.web_root):
                    return self.respond(403, {'error': '路径无效。'})
            if not file.is_file():
                return self.respond(404, {'error': '文件不存在。请先运行 npm run build。'})
            return self.respond(200, file.read_bytes(), mimetypes.guess_type(file.name)[0] or 'application/octet-stream')

        def do_POST(self):
            try:
                origin = self.headers.get('Origin')
                if origin and urllib.parse.urlparse(origin).netloc != self.headers.get('Host'):
                    return self.respond(403, {'error': '请从 InkMuse 页面发起请求。'})
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 100000:
                    raise ValueError('请求大小无效，请缩短文字后重试。')
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('请求格式无效。')
                path = urllib.parse.urlparse(self.path).path
                if path == '/api/design':
                    result = app.design(data)
                elif path == '/api/images/search':
                    result = {'images': app.images.search(str(data.get('query', '')))}
                elif path == '/api/images/select':
                    result = {'image': app.images.select(data.get('id'))}
                elif path == '/api/images/generate':
                    prompt = str(data.get('prompt', '')).strip()
                    if not 5 <= len(prompt) <= 2000:
                        raise ValueError('请用 5 至 2000 字描述希望生成的图片。')
                    result = {'image': app.images.generate(prompt, app.config.get('generation'))}
                else:
                    return self.respond(404, {'error': '接口不存在。'})
                return self.respond(200, result)
            except (ValueError, TypeError, KeyError) as exc:
                return self.respond(400, {'error': str(exc)})
            except (RuntimeError, OSError) as exc:
                return self.respond(502, {'error': str(exc)})

    return Handler


def main():
    parser = argparse.ArgumentParser(description='Run InkMuse design, image search, and browser preview.')
    parser.add_argument('--config', required=True, help='Path to the server JSON configuration; relative paths resolve from this file.')
    parser.add_argument('--port', type=int, help='Override the configured listening port.')
    parser.add_argument('--host', help='Override the configured host; default is local only.')
    args = parser.parse_args()
    config_path = Path(args.config).resolve()
    config = json.loads(config_path.read_text(encoding='utf-8'))
    for key in ('web_root', 'asset_dir'):
        config[key] = str((config_path.parent / config[key]).resolve())
    app = App(config)
    address = (args.host or config.get('host', '127.0.0.1'), args.port or config.get('port', 8765))
    server = ThreadingHTTPServer(address, make_handler(app))
    print(f'InkMuse by Baixue · http://{address[0]}:{address[1]}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
