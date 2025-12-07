"""
보탬e 사이트 심층 분석 스크립트
- 로그인 후 전체 메뉴 구조 파악
- 화면별 입력 요소 추출
- DOM 구조 로깅
"""

import json
import os
from datetime import datetime
from playwright.sync_api import sync_playwright

# 설정
BASE_URL = "https://www.losims.go.kr"
LOGIN_URL = "https://www.losims.go.kr/lss.do"  # 업무시스템 URL
CREDENTIALS = {
    "user_id": "gopeace",
    "password": "gopeace123!"
}

OUTPUT_DIR = "/mnt/d/00.Projects/02.보탬e/site_analysis/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def extract_interactive_elements(page):
    """페이지의 모든 상호작용 가능한 요소 추출"""
    elements = page.evaluate("""
        () => {
            const results = {
                inputs: [],
                buttons: [],
                selects: [],
                links: [],
                textareas: [],
                checkboxes: [],
                radios: []
            };

            // Input 요소
            document.querySelectorAll('input:not([type="hidden"])').forEach(el => {
                results.inputs.push({
                    type: el.type || 'text',
                    id: el.id || null,
                    name: el.name || null,
                    class: el.className || null,
                    placeholder: el.placeholder || null,
                    selector: generateSelector(el)
                });
            });

            // Button 요소
            document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, [role="button"]').forEach(el => {
                results.buttons.push({
                    text: el.innerText?.trim() || el.value || null,
                    id: el.id || null,
                    class: el.className || null,
                    selector: generateSelector(el)
                });
            });

            // Select 요소
            document.querySelectorAll('select').forEach(el => {
                const options = [];
                el.querySelectorAll('option').forEach(opt => {
                    options.push({value: opt.value, text: opt.innerText});
                });
                results.selects.push({
                    id: el.id || null,
                    name: el.name || null,
                    class: el.className || null,
                    options: options,
                    selector: generateSelector(el)
                });
            });

            // 메뉴 링크
            document.querySelectorAll('a[href]').forEach(el => {
                const href = el.getAttribute('href');
                if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
                    results.links.push({
                        text: el.innerText?.trim() || null,
                        href: href,
                        id: el.id || null,
                        class: el.className || null,
                        selector: generateSelector(el)
                    });
                }
            });

            // Textarea
            document.querySelectorAll('textarea').forEach(el => {
                results.textareas.push({
                    id: el.id || null,
                    name: el.name || null,
                    class: el.className || null,
                    placeholder: el.placeholder || null,
                    selector: generateSelector(el)
                });
            });

            // Checkbox
            document.querySelectorAll('input[type="checkbox"]').forEach(el => {
                results.checkboxes.push({
                    id: el.id || null,
                    name: el.name || null,
                    class: el.className || null,
                    label: getLabel(el),
                    selector: generateSelector(el)
                });
            });

            // Radio
            document.querySelectorAll('input[type="radio"]').forEach(el => {
                results.radios.push({
                    id: el.id || null,
                    name: el.name || null,
                    value: el.value || null,
                    class: el.className || null,
                    label: getLabel(el),
                    selector: generateSelector(el)
                });
            });

            function generateSelector(el) {
                if (el.id) return '#' + el.id;
                if (el.name) return `[name="${el.name}"]`;
                if (el.className) {
                    const classes = el.className.split(' ').filter(c => c).join('.');
                    if (classes) return el.tagName.toLowerCase() + '.' + classes;
                }
                return null;
            }

            function getLabel(el) {
                if (el.id) {
                    const label = document.querySelector(`label[for="${el.id}"]`);
                    if (label) return label.innerText?.trim();
                }
                const parent = el.closest('label');
                if (parent) return parent.innerText?.trim();
                return null;
            }

            return results;
        }
    """)
    return elements

def extract_menu_structure(page):
    """메뉴 구조 추출"""
    menu = page.evaluate("""
        () => {
            const menus = [];

            // 일반적인 네비게이션 메뉴 패턴들
            const navSelectors = [
                'nav', '.nav', '#nav',
                '.menu', '#menu', '.gnb', '#gnb',
                '.lnb', '#lnb', '.sidebar', '#sidebar',
                '[role="navigation"]', '.navigation'
            ];

            navSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(nav => {
                    const items = [];
                    nav.querySelectorAll('a, button').forEach(el => {
                        items.push({
                            text: el.innerText?.trim(),
                            href: el.getAttribute('href'),
                            selector: el.id ? '#' + el.id : null
                        });
                    });
                    if (items.length > 0) {
                        menus.push({
                            selector: selector,
                            items: items
                        });
                    }
                });
            });

            return menus;
        }
    """)
    return menu

def save_screenshot(page, name):
    """스크린샷 저장"""
    path = os.path.join(OUTPUT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"Screenshot saved: {path}")
    return path

def save_json(data, name):
    """JSON 파일 저장"""
    path = os.path.join(OUTPUT_DIR, f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON saved: {path}")
    return path

def analyze_login_page(page):
    """로그인 페이지 분석"""
    print("\n=== 로그인 페이지 분석 ===")

    # 스크린샷
    save_screenshot(page, "01_login_page")

    # 요소 추출
    elements = extract_interactive_elements(page)
    save_json(elements, "01_login_elements")

    print(f"- Input 요소: {len(elements['inputs'])}개")
    print(f"- Button 요소: {len(elements['buttons'])}개")

    return elements

def do_login(page, credentials):
    """로그인 수행"""
    print("\n=== 로그인 시도 ===")

    # 1. 먼저 "아이디 로그인" 탭 클릭
    try:
        id_login_tab = page.locator('text=아이디 로그인').first
        if id_login_tab.is_visible():
            print("아이디 로그인 탭 클릭")
            id_login_tab.click()
            page.wait_for_timeout(1000)  # 탭 전환 대기
            save_screenshot(page, "01b_id_login_tab")
    except Exception as e:
        print(f"탭 전환 오류: {e}")

    # 2. 페이지의 모든 요소 다시 추출
    elements = extract_interactive_elements(page)
    save_json(elements, "01b_id_login_elements")
    print(f"탭 전환 후 Input 요소: {len(elements['inputs'])}개")

    # 3. 보탬e 특화 로그인 (input.cl-text 사용)
    try:
        id_field = page.locator('input[type="text"].cl-text').first
        pw_field = page.locator('input[type="password"].cl-text').first

        if id_field.is_visible() and pw_field.is_visible():
            print("보탬e 로그인 폼 발견")
            id_field.fill(credentials['user_id'])
            print(f"  - ID 입력 완료: {credentials['user_id']}")
            pw_field.fill(credentials['password'])
            print("  - 비밀번호 입력 완료")

            save_screenshot(page, "01c_before_login_click")

            # 로그인 버튼 클릭 - 여러 셀렉터 시도
            login_btn_selectors = [
                'a.cl-text-wrapper >> text=로그인',
                'text=로그인 >> nth=0',
                ':text-is("로그인")',
                'a:has-text("로그인")',
            ]

            for btn_selector in login_btn_selectors:
                try:
                    login_btn = page.locator(btn_selector).first
                    if login_btn.is_visible():
                        print(f"  - 로그인 버튼 발견: {btn_selector}")
                        login_btn.click()

                        # 클릭 직후 1초 대기 후 스크린샷
                        page.wait_for_timeout(1000)
                        save_screenshot(page, "01d_after_click_1sec")

                        # 알럿/팝업 확인
                        try:
                            alert = page.locator('[role="alert"], .alert, .modal, .popup, [class*="alert"], [class*="modal"]')
                            if alert.first.is_visible(timeout=2000):
                                alert_text = alert.first.inner_text()
                                print(f"  ⚠️ 알럿 발견: {alert_text}")
                        except:
                            pass

                        page.wait_for_load_state('networkidle', timeout=30000)
                        page.wait_for_timeout(2000)

                        # 로그인 후 스크린샷
                        save_screenshot(page, "01e_after_login_wait")
                        print(f"  - 로그인 후 URL: {page.url}")

                        return True
                except Exception as e:
                    print(f"  버튼 클릭 오류: {e}")
                    continue

            # 마지막 시도: 파란 버튼 직접 클릭
            try:
                blue_btn = page.locator('.cl-text-wrapper').filter(has_text="로그인").first
                blue_btn.click()
                page.wait_for_load_state('networkidle', timeout=30000)
                page.wait_for_timeout(3000)
                print("로그인 완료 (파란 버튼)")
                return True
            except:
                pass
    except Exception as e:
        print(f"보탬e 로그인 오류: {e}")

    # 4. 일반적인 로그인 폼 시도 (fallback)
    login_selectors = [
        {'id': '#userId', 'pw': '#password'},
        {'id': '#user_id', 'pw': '#user_pw'},
        {'id': 'input[type="text"]', 'pw': 'input[type="password"]'},
    ]

    for selectors in login_selectors:
        try:
            id_field = page.locator(selectors['id']).first
            pw_field = page.locator(selectors['pw']).first

            if id_field.is_visible() and pw_field.is_visible():
                print(f"로그인 폼 발견: {selectors}")
                id_field.fill(credentials['user_id'])
                pw_field.fill(credentials['password'])

                login_btn = page.locator('button[type="submit"], input[type="submit"], a:has-text("로그인")').first
                if login_btn.is_visible():
                    login_btn.click()
                    page.wait_for_load_state('networkidle', timeout=15000)
                    print("로그인 버튼 클릭 완료")
                    return True
        except Exception as e:
            continue

    print("로그인 폼을 찾지 못했습니다.")
    return False

def analyze_main_page(page):
    """메인 페이지(로그인 후) 분석"""
    print("\n=== 메인 페이지 분석 ===")

    # 스크린샷
    save_screenshot(page, "02_main_page")

    # 메뉴 구조
    menu = extract_menu_structure(page)
    save_json(menu, "02_menu_structure")

    # 모든 요소
    elements = extract_interactive_elements(page)
    save_json(elements, "02_main_elements")

    print(f"- 메뉴 그룹: {len(menu)}개")
    print(f"- 링크: {len(elements['links'])}개")

    return menu, elements

def explore_menus(page, menu_structure):
    """각 메뉴 탐색"""
    print("\n=== 메뉴 탐색 시작 ===")

    visited = set()
    all_pages = {}

    # 메뉴에서 링크 추출
    for menu_group in menu_structure:
        for item in menu_group.get('items', []):
            href = item.get('href')
            text = item.get('text')

            if href and href not in visited and not href.startswith(('javascript:', '#', 'mailto:')):
                visited.add(href)

                try:
                    print(f"\n탐색 중: {text} ({href})")

                    # 페이지 이동
                    if href.startswith('http'):
                        page.goto(href, timeout=15000)
                    else:
                        page.goto(BASE_URL + href, timeout=15000)

                    page.wait_for_load_state('networkidle', timeout=10000)

                    # 페이지 분석
                    page_name = text.replace(' ', '_').replace('/', '_') if text else 'unknown'
                    elements = extract_interactive_elements(page)

                    all_pages[href] = {
                        'name': text,
                        'url': href,
                        'elements': elements
                    }

                    # 스크린샷
                    save_screenshot(page, f"page_{page_name}")

                    print(f"  - Input: {len(elements['inputs'])}개")
                    print(f"  - Button: {len(elements['buttons'])}개")
                    print(f"  - Select: {len(elements['selects'])}개")

                except Exception as e:
                    print(f"  오류: {e}")

    save_json(all_pages, "03_all_pages")
    return all_pages

def main():
    print("=" * 60)
    print("보탬e 사이트 심층 분석")
    print(f"시작 시간: {datetime.now()}")
    print("=" * 60)

    with sync_playwright() as p:
        # 브라우저 시작 (headless=False로 볼 수 있게)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR'
        )
        page = context.new_page()

        # 콘솔 로그 캡처
        console_logs = []
        page.on('console', lambda msg: console_logs.append({
            'type': msg.type,
            'text': msg.text
        }))

        # JavaScript alert/dialog 캡처
        dialog_messages = []
        def handle_dialog(dialog):
            msg = dialog.message
            dialog_messages.append({'type': dialog.type, 'message': msg})
            print(f"  📢 Dialog ({dialog.type}): {msg}")
            dialog.accept()  # alert 자동 확인

        page.on('dialog', handle_dialog)

        # 네트워크 요청/응답 캡처 (로그인 관련)
        network_logs = []
        def handle_response(response):
            url = response.url
            if 'login' in url.lower() or 'auth' in url.lower() or 'lss' in url.lower():
                try:
                    body = response.text() if response.status < 300 else None
                    network_logs.append({
                        'url': url,
                        'status': response.status,
                        'body_preview': body[:500] if body else None
                    })
                except:
                    network_logs.append({
                        'url': url,
                        'status': response.status
                    })

        page.on('response', handle_response)

        try:
            # 1. 업무시스템 접속
            print(f"\n업무시스템 접속: {LOGIN_URL}")
            page.goto(LOGIN_URL, timeout=30000)
            page.wait_for_load_state('networkidle')

            # 현재 URL 확인
            current_url = page.url
            print(f"현재 URL: {current_url}")

            # 2. 로그인 페이지 분석
            login_elements = analyze_login_page(page)

            # 3. 로그인 시도
            login_success = do_login(page, CREDENTIALS)

            if login_success:
                # 4. 메인 페이지 분석
                page.wait_for_timeout(2000)  # 로그인 후 안정화 대기

                # 로그인 후 URL 확인
                after_login_url = page.url
                print(f"로그인 후 URL: {after_login_url}")

                save_screenshot(page, "02_after_login")

                # 로그인 실패 여부 확인 (여전히 로그인 페이지인 경우)
                if 'lss.do' in after_login_url and page.locator('text=아이디 로그인').is_visible():
                    print("⚠️ 로그인 실패 - 여전히 로그인 페이지")
                    # 에러 메시지 확인
                    error_msgs = page.locator('.error, .alert, .message, [class*="error"], [class*="alert"]').all_text_contents()
                    if error_msgs:
                        print(f"에러 메시지: {error_msgs}")

                    # 페이지 전체 텍스트에서 에러 찾기
                    page_text = page.inner_text('body')
                    if '비밀번호' in page_text and ('오류' in page_text or '틀' in page_text or '일치' in page_text):
                        print("비밀번호 관련 오류 감지")
                    save_json({'login_failed': True, 'url': after_login_url}, "login_result")
                else:
                    print("✅ 로그인 성공!")
                    menu, elements = analyze_main_page(page)

                # 5. 메뉴 탐색
                # explore_menus(page, menu)  # 시간이 오래 걸릴 수 있어 주석 처리

            # 콘솔 로그 저장
            save_json(console_logs, "console_logs")
            save_json(dialog_messages, "dialog_messages")
            save_json(network_logs, "network_logs")

        except Exception as e:
            print(f"\n오류 발생: {e}")
            save_screenshot(page, "error_screenshot")
            raise

        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("분석 완료")
    print(f"결과 저장 위치: {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
