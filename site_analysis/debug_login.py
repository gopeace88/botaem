"""
보탬e 로그인 디버깅 - headless=False로 실제 동작 확인
"""

import time
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.losims.go.kr/lss.do"
CREDENTIALS = {
    "user_id": "gopeace",
    "password": "gopeace123!"
}

def main():
    print("=" * 60)
    print("보탬e 로그인 디버깅 (실제 브라우저)")
    print("=" * 60)

    with sync_playwright() as p:
        # headless=False로 실제 브라우저 표시
        browser = p.chromium.launch(
            headless=False,
            slow_mo=500  # 동작을 천천히 (500ms 딜레이)
        )
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR'
        )
        page = context.new_page()

        # dialog 핸들러
        def handle_dialog(dialog):
            print(f"📢 Dialog: {dialog.type} - {dialog.message}")
            dialog.accept()
        page.on('dialog', handle_dialog)

        try:
            # 1. 페이지 접속
            print("\n1. 페이지 접속...")
            page.goto(BASE_URL, timeout=30000)
            page.wait_for_load_state('networkidle')
            print(f"   URL: {page.url}")

            # 2. 아이디 로그인 탭 클릭
            print("\n2. 아이디 로그인 탭 클릭...")
            tab = page.locator('text=아이디 로그인')
            tab.click()
            page.wait_for_timeout(1000)

            # 3. ID 입력
            print("\n3. ID 입력...")
            id_input = page.locator('input[type="text"].cl-text')
            id_input.click()
            id_input.fill(CREDENTIALS['user_id'])
            print(f"   입력된 값: {id_input.input_value()}")

            # 4. 비밀번호 입력
            print("\n4. 비밀번호 입력...")
            pw_input = page.locator('input[type="password"].cl-text')
            pw_input.click()
            pw_input.fill(CREDENTIALS['password'])
            print(f"   입력된 값 길이: {len(pw_input.input_value())}")

            # 5. 로그인 버튼 클릭 - 여러 방법 시도
            print("\n5. 로그인 버튼 클릭...")

            # 방법 1: ID로 클릭
            login_btn = page.locator('#uuid-9ee1015e-8356-1be1-7fa1-1d74e5a6ddf8')
            if login_btn.is_visible():
                print("   방법 1: ID로 클릭 시도")
                login_btn.click()
            else:
                # 방법 2: 텍스트로 클릭
                print("   방법 2: 텍스트로 클릭 시도")
                login_btn = page.locator('.btn-login:visible >> text=로그인')
                login_btn.click()

            # 6. 결과 대기
            print("\n6. 결과 대기 중...")
            page.wait_for_timeout(5000)

            # 7. 결과 확인
            print(f"\n7. 결과 URL: {page.url}")

            if 'lss.do' not in page.url or not page.locator('text=아이디 로그인').is_visible():
                print("✅ 로그인 성공!")

                # 메인 페이지 요소 확인
                page.wait_for_timeout(3000)
                page.screenshot(path="/mnt/d/00.Projects/02.보탬e/site_analysis/output/debug_success.png")
                print("   스크린샷 저장 완료")
            else:
                print("❌ 로그인 실패 - 여전히 로그인 페이지")
                page.screenshot(path="/mnt/d/00.Projects/02.보탬e/site_analysis/output/debug_failed.png")

            # 브라우저를 10초 동안 열어둠 (확인용)
            print("\n브라우저를 10초 동안 유지합니다...")
            page.wait_for_timeout(10000)

        except Exception as e:
            print(f"\n오류: {e}")
            page.screenshot(path="/mnt/d/00.Projects/02.보탬e/site_analysis/output/debug_error.png")

        finally:
            browser.close()

    print("\n완료")

if __name__ == "__main__":
    main()
