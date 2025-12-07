#!/usr/bin/env python3
"""Chrome DevTools Protocol을 통한 보탬e 접속 테스트"""
import asyncio
import json
import websockets
import base64
import os

CHROME_HOST = "172.25.176.1"
CHROME_PORT = 9222
BOTAME_URL = "https://www.losims.go.kr/lss.do"
USER_ID = "gopeace"
PASSWORD = "gopeace123!"

async def send_command(ws, method, params=None):
    """CDP 명령 전송"""
    cmd_id = id(method)
    cmd = {"id": cmd_id, "method": method}
    if params:
        cmd["params"] = params
    await ws.send(json.dumps(cmd))

    while True:
        response = await ws.recv()
        data = json.loads(response)
        if data.get("id") == cmd_id:
            return data
        # 이벤트는 무시

async def main():
    import httpx

    print("=" * 60)
    print("보탬e 로그인 테스트 (CDP)")
    print("=" * 60)

    # 1. Chrome 탭 정보 가져오기
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"http://{CHROME_HOST}:{CHROME_PORT}/json/list")
        tabs = resp.json()

    # 메인 페이지 탭 찾기
    page_tab = None
    for tab in tabs:
        if tab["type"] == "page" and "new-tab" in tab["url"]:
            page_tab = tab
            break

    if not page_tab:
        page_tab = tabs[0]

    ws_url = page_tab["webSocketDebuggerUrl"]
    print(f"\n[1] WebSocket 연결: {ws_url}")

    async with websockets.connect(ws_url) as ws:
        # 2. 페이지 이동
        print(f"\n[2] 사이트 접속: {BOTAME_URL}")
        await send_command(ws, "Page.enable")
        await send_command(ws, "Page.navigate", {"url": BOTAME_URL})

        # 페이지 로딩 대기
        await asyncio.sleep(3)

        # 3. 스크린샷 촬영
        print("\n[3] 스크린샷 촬영...")
        result = await send_command(ws, "Page.captureScreenshot", {"format": "png"})
        if "result" in result and "data" in result["result"]:
            os.makedirs("screenshots", exist_ok=True)
            img_data = base64.b64decode(result["result"]["data"])
            with open("screenshots/01_login_page.png", "wb") as f:
                f.write(img_data)
            print("    -> screenshots/01_login_page.png 저장됨")

        # 4. DOM 분석 - 로그인 폼 찾기
        print("\n[4] 로그인 폼 분석...")

        # JavaScript로 폼 요소 찾기
        js_code = """
        (function() {
            var result = {
                id_field: null,
                pw_field: null,
                login_btn: null,
                forms: []
            };

            // 아이디 입력 필드
            var idSelectors = ['input[name="userId"]', 'input[name="user_id"]', 'input[name="id"]',
                               'input#userId', 'input#user_id', 'input#id', 'input[type="text"]'];
            for (var i = 0; i < idSelectors.length; i++) {
                var el = document.querySelector(idSelectors[i]);
                if (el) {
                    result.id_field = idSelectors[i];
                    break;
                }
            }

            // 비밀번호 입력 필드
            var pwSelectors = ['input[name="password"]', 'input[name="userPw"]', 'input[name="pwd"]',
                               'input#password', 'input#userPw', 'input[type="password"]'];
            for (var i = 0; i < pwSelectors.length; i++) {
                var el = document.querySelector(pwSelectors[i]);
                if (el) {
                    result.pw_field = pwSelectors[i];
                    break;
                }
            }

            // 로그인 버튼
            var btnSelectors = ['button[type="submit"]', 'input[type="submit"]',
                                'button.login', 'a.login', '#loginBtn'];
            for (var i = 0; i < btnSelectors.length; i++) {
                var el = document.querySelector(btnSelectors[i]);
                if (el) {
                    result.login_btn = btnSelectors[i];
                    break;
                }
            }

            // 모든 폼 정보
            var forms = document.querySelectorAll('form');
            forms.forEach(function(f) {
                result.forms.push({
                    id: f.id,
                    name: f.name,
                    action: f.action
                });
            });

            return JSON.stringify(result);
        })()
        """

        result = await send_command(ws, "Runtime.evaluate", {"expression": js_code})
        if "result" in result and "result" in result["result"]:
            form_info = json.loads(result["result"]["result"]["value"])
            print(f"    -> 아이디 필드: {form_info['id_field']}")
            print(f"    -> 비밀번호 필드: {form_info['pw_field']}")
            print(f"    -> 로그인 버튼: {form_info['login_btn']}")
            print(f"    -> 폼 개수: {len(form_info['forms'])}")

            if form_info['id_field'] and form_info['pw_field']:
                # 5. 로그인 시도
                print(f"\n[5] 로그인 시도: {USER_ID}")

                # 아이디 입력
                await send_command(ws, "Runtime.evaluate", {
                    "expression": f'document.querySelector("{form_info["id_field"]}").value = "{USER_ID}"'
                })

                # 비밀번호 입력
                await send_command(ws, "Runtime.evaluate", {
                    "expression": f'document.querySelector("{form_info["pw_field"]}").value = "{PASSWORD}"'
                })

                # 스크린샷
                await asyncio.sleep(1)
                result = await send_command(ws, "Page.captureScreenshot", {"format": "png"})
                if "result" in result:
                    img_data = base64.b64decode(result["result"]["data"])
                    with open("screenshots/02_credentials.png", "wb") as f:
                        f.write(img_data)
                    print("    -> screenshots/02_credentials.png 저장됨")

                # 로그인 버튼 클릭 또는 폼 제출
                if form_info['login_btn']:
                    await send_command(ws, "Runtime.evaluate", {
                        "expression": f'document.querySelector("{form_info["login_btn"]}").click()'
                    })
                else:
                    await send_command(ws, "Runtime.evaluate", {
                        "expression": 'document.forms[0].submit()'
                    })

                print("    -> 로그인 버튼 클릭")

                # 6. 결과 확인
                await asyncio.sleep(3)
                print("\n[6] 로그인 결과 확인...")

                result = await send_command(ws, "Page.captureScreenshot", {"format": "png"})
                if "result" in result:
                    img_data = base64.b64decode(result["result"]["data"])
                    with open("screenshots/03_after_login.png", "wb") as f:
                        f.write(img_data)
                    print("    -> screenshots/03_after_login.png 저장됨")

                # 현재 URL 확인
                result = await send_command(ws, "Runtime.evaluate", {
                    "expression": "window.location.href"
                })
                if "result" in result:
                    current_url = result["result"]["result"]["value"]
                    print(f"    -> 현재 URL: {current_url}")
            else:
                print("\n[!] 로그인 폼을 찾을 수 없습니다.")

        print("\n" + "=" * 60)
        print("테스트 완료! screenshots 폴더를 확인하세요.")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
