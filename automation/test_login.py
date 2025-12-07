"""보탬e 로그인 테스트 스크립트 (Windows에서 직접 실행)"""
import asyncio
from playwright.async_api import async_playwright


async def test_login():
    """로그인 테스트"""
    # 접속 정보
    URL = "https://www.losims.go.kr/lss.do"
    USER_ID = "gopeace"
    PASSWORD = "gopeace123!"

    print("=" * 50)
    print("보탬e 로그인 테스트")
    print("=" * 50)

    async with async_playwright() as p:
        # 브라우저 실행 (화면 표시)
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR'
        )
        page = await context.new_page()

        try:
            # 1. 사이트 접속
            print(f"\n[1] 사이트 접속: {URL}")
            await page.goto(URL)
            await page.wait_for_load_state('networkidle')

            # 스크린샷 저장
            await page.screenshot(path="screenshots/01_login_page.png")
            print("    -> 스크린샷 저장: screenshots/01_login_page.png")

            # 2. 로그인 폼 분석
            print("\n[2] 로그인 폼 분석 중...")

            # 아이디 입력 필드 찾기
            id_selectors = [
                'input[name="userId"]',
                'input[name="user_id"]',
                'input[name="id"]',
                'input#userId',
                'input#user_id',
                'input#id',
                'input[type="text"]'
            ]

            id_field = None
            for selector in id_selectors:
                id_field = await page.query_selector(selector)
                if id_field:
                    print(f"    -> 아이디 필드 발견: {selector}")
                    break

            # 비밀번호 입력 필드 찾기
            pw_selectors = [
                'input[name="password"]',
                'input[name="userPw"]',
                'input[name="pwd"]',
                'input#password',
                'input#userPw',
                'input[type="password"]'
            ]

            pw_field = None
            for selector in pw_selectors:
                pw_field = await page.query_selector(selector)
                if pw_field:
                    print(f"    -> 비밀번호 필드 발견: {selector}")
                    break

            # 로그인 버튼 찾기
            login_btn_selectors = [
                'button[type="submit"]',
                'button:has-text("로그인")',
                'input[type="submit"]',
                'a:has-text("로그인")',
                '.login-btn',
                '#loginBtn'
            ]

            login_btn = None
            for selector in login_btn_selectors:
                login_btn = await page.query_selector(selector)
                if login_btn:
                    print(f"    -> 로그인 버튼 발견: {selector}")
                    break

            if not id_field or not pw_field:
                print("\n[!] 로그인 폼을 찾을 수 없습니다.")
                print("    페이지 HTML을 확인하세요.")

                # 페이지 HTML 일부 저장
                html = await page.content()
                with open("screenshots/page_source.html", "w", encoding="utf-8") as f:
                    f.write(html)
                print("    -> HTML 저장: screenshots/page_source.html")

                input("\n계속하려면 Enter를 누르세요...")
                return

            # 3. 로그인 시도
            print(f"\n[3] 로그인 시도: {USER_ID}")
            await id_field.fill(USER_ID)
            await pw_field.fill(PASSWORD)

            await page.screenshot(path="screenshots/02_credentials_entered.png")
            print("    -> 스크린샷 저장: screenshots/02_credentials_entered.png")

            if login_btn:
                await login_btn.click()
            else:
                await page.keyboard.press("Enter")

            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(2)

            # 4. 로그인 결과 확인
            print("\n[4] 로그인 결과 확인...")
            await page.screenshot(path="screenshots/03_after_login.png")
            print("    -> 스크린샷 저장: screenshots/03_after_login.png")

            # 에러 메시지 확인
            error_selectors = [
                '.error-message',
                '.login-error',
                '.alert-danger',
                '.err_msg'
            ]

            for selector in error_selectors:
                error_el = await page.query_selector(selector)
                if error_el:
                    error_text = await error_el.inner_text()
                    print(f"    [!] 오류 메시지: {error_text}")
                    break
            else:
                # 성공 여부 확인 (URL 변경 또는 메뉴 존재)
                current_url = page.url
                print(f"    -> 현재 URL: {current_url}")

                # 메인 메뉴 확인
                menu_el = await page.query_selector('.gnb, .main-menu, nav')
                if menu_el:
                    print("    -> 메인 메뉴 발견 - 로그인 성공 추정")

            # 5. 메뉴 구조 탐색
            print("\n[5] 메뉴 구조 탐색...")
            menus = await page.query_selector_all('nav a, .menu a, .gnb a, .lnb a')
            if menus:
                print(f"    -> 메뉴 {len(menus)}개 발견:")
                for i, menu in enumerate(menus[:20]):  # 최대 20개만
                    text = await menu.inner_text()
                    href = await menu.get_attribute('href')
                    if text.strip():
                        print(f"       [{i+1}] {text.strip()}")

            print("\n" + "=" * 50)
            print("테스트 완료!")
            print("screenshots 폴더에서 스크린샷을 확인하세요.")
            print("=" * 50)

            input("\n브라우저를 닫으려면 Enter를 누르세요...")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            await page.screenshot(path="screenshots/error.png")
            input("\n오류 발생. Enter를 누르면 종료됩니다...")

        finally:
            await browser.close()


if __name__ == "__main__":
    import os
    os.makedirs("screenshots", exist_ok=True)
    asyncio.run(test_login())
