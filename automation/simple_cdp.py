#!/usr/bin/env python3
"""간단한 CDP 테스트 - 표준 라이브러리만 사용"""
import json
import socket
import hashlib
import base64
import struct
import os

CHROME_HOST = "172.25.176.1"
CHROME_PORT = 9222
URL = "https://www.losims.go.kr/lss.do"

def http_get(host, port, path):
    """간단한 HTTP GET"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))
    request = f"GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
    s.send(request.encode())
    response = b""
    while True:
        data = s.recv(4096)
        if not data:
            break
        response += data
    s.close()
    # HTTP 헤더 제거
    body = response.split(b"\r\n\r\n", 1)[1]
    return body.decode()

def ws_connect(host, port, path):
    """WebSocket 연결"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))

    key = base64.b64encode(os.urandom(16)).decode()
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    s.send(request.encode())

    response = s.recv(4096)
    if b"101" not in response:
        raise Exception("WebSocket 연결 실패")

    return s

def ws_send(sock, data):
    """WebSocket 메시지 전송"""
    payload = data.encode()
    length = len(payload)

    frame = bytearray()
    frame.append(0x81)  # text frame

    mask_key = os.urandom(4)

    if length < 126:
        frame.append(0x80 | length)
    elif length < 65536:
        frame.append(0x80 | 126)
        frame.extend(struct.pack(">H", length))
    else:
        frame.append(0x80 | 127)
        frame.extend(struct.pack(">Q", length))

    frame.extend(mask_key)

    masked = bytearray(payload)
    for i in range(len(masked)):
        masked[i] ^= mask_key[i % 4]
    frame.extend(masked)

    sock.send(bytes(frame))

def ws_recv(sock):
    """WebSocket 메시지 수신"""
    header = sock.recv(2)
    if len(header) < 2:
        return None

    length = header[1] & 0x7F

    if length == 126:
        length = struct.unpack(">H", sock.recv(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", sock.recv(8))[0]

    data = b""
    while len(data) < length:
        chunk = sock.recv(length - len(data))
        if not chunk:
            break
        data += chunk

    return data.decode()

def main():
    print("=" * 60)
    print("보탬e 접속 테스트")
    print("=" * 60)

    # 1. 탭 목록 조회
    print("\n[1] Chrome 탭 조회...")
    tabs_json = http_get(CHROME_HOST, CHROME_PORT, "/json/list")
    tabs = json.loads(tabs_json)

    page_tab = None
    for tab in tabs:
        if tab["type"] == "page" and "new-tab" in tab.get("url", ""):
            page_tab = tab
            break

    if not page_tab:
        page_tab = [t for t in tabs if t["type"] == "page"][0]

    print(f"    탭 ID: {page_tab['id']}")
    print(f"    현재 URL: {page_tab['url']}")

    # 2. WebSocket 연결
    ws_path = f"/devtools/page/{page_tab['id']}"
    print(f"\n[2] WebSocket 연결: {ws_path}")
    ws = ws_connect(CHROME_HOST, CHROME_PORT, ws_path)
    print("    연결 성공!")

    # 3. 페이지 이동
    print(f"\n[3] 사이트 접속: {URL}")
    cmd = json.dumps({
        "id": 1,
        "method": "Page.navigate",
        "params": {"url": URL}
    })
    ws_send(ws, cmd)

    # 응답 대기
    for _ in range(10):
        resp = ws_recv(ws)
        if resp:
            data = json.loads(resp)
            if data.get("id") == 1:
                print(f"    응답: {data}")
                break

    # 4. 로딩 대기
    print("\n[4] 페이지 로딩 대기 (3초)...")
    import time
    time.sleep(3)

    # 5. 스크린샷
    print("\n[5] 스크린샷 촬영...")
    cmd = json.dumps({
        "id": 2,
        "method": "Page.captureScreenshot",
        "params": {"format": "png"}
    })
    ws_send(ws, cmd)

    for _ in range(30):
        resp = ws_recv(ws)
        if resp:
            data = json.loads(resp)
            if data.get("id") == 2 and "result" in data:
                os.makedirs("screenshots", exist_ok=True)
                img = base64.b64decode(data["result"]["data"])
                with open("screenshots/01_page.png", "wb") as f:
                    f.write(img)
                print("    저장: screenshots/01_page.png")
                break

    # 6. 페이지 HTML 가져오기
    print("\n[6] 로그인 폼 분석...")
    cmd = json.dumps({
        "id": 3,
        "method": "Runtime.evaluate",
        "params": {
            "expression": """
            (function() {
                var forms = document.querySelectorAll('form');
                var inputs = document.querySelectorAll('input');
                var result = {forms: [], inputs: []};
                forms.forEach(function(f) {
                    result.forms.push({id: f.id, name: f.name, action: f.action});
                });
                inputs.forEach(function(i) {
                    result.inputs.push({
                        type: i.type,
                        name: i.name,
                        id: i.id,
                        placeholder: i.placeholder
                    });
                });
                return JSON.stringify(result);
            })()
            """
        }
    })
    ws_send(ws, cmd)

    for _ in range(10):
        resp = ws_recv(ws)
        if resp:
            data = json.loads(resp)
            if data.get("id") == 3 and "result" in data:
                result = data["result"].get("result", {})
                if result.get("value"):
                    form_data = json.loads(result["value"])
                    print(f"    폼 개수: {len(form_data['forms'])}")
                    print(f"    입력 필드:")
                    for inp in form_data['inputs']:
                        if inp['type'] in ['text', 'password']:
                            print(f"      - {inp['type']}: name={inp['name']}, id={inp['id']}")
                break

    ws.close()
    print("\n" + "=" * 60)
    print("완료! screenshots/01_page.png 확인하세요")
    print("=" * 60)

if __name__ == "__main__":
    main()
