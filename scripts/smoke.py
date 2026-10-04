"""Exercise a real design provider and online image search."""
import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Generate one real InkMuse design and save its service response.')
    parser.add_argument('--url', required=True, help='Running InkMuse service URL.')
    parser.add_argument('--out', required=True, help='JSON result path.')
    parser.add_argument('--text-file', help='Optional UTF-8 source file.')
    parser.add_argument('--no-pictures', action='store_true', help='Skip online image search.')
    args = parser.parse_args()
    text = Path(args.text_file).read_text() if args.text_file else '把周末，还给自己\n\n我们总想把休息日过得很充实：约朋友、赶展览、补上工作日没做完的事。可有时候，真正需要的不是更多安排，而是一点空白。\n\n早起半小时，慢慢喝完一杯咖啡。不刷手机，听听窗外的声音，让身体比消息先醒来。\n\n走一条没有目的地的路。绕过熟悉的街口，去看一棵树、一家小店，或者傍晚落在墙上的光。\n\n休息不需要证明它有用。那些没有被填满的时间，也可以是生活里很好的部分。'
    body = {'text': text, 'mood': 'auto', 'mode': 'polish', 'pictures': not args.no_pictures}
    request = urllib.request.Request(args.url.rstrip('/') + '/api/design', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    start = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=210) as response:
            result = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode()) from exc
    result['source'] = text
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({'seconds': round(time.monotonic() - start, 1), 'pages': len(result['plan']['pages']),
                      'images': sum(bool(p.get('image')) for p in result['plan']['pages']), 'warnings': result['warnings'], 'note': result['plan'].get('note')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
