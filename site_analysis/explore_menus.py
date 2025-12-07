"""
보탬e 전체 메뉴 구조 탐색 및 화면별 요소 추출
"""

import json
import os
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.losims.go.kr/lss.do"
CREDENTIALS = {
    "user_id": "gopeace",
    "password": "gopeace123!"
}

OUTPUT_DIR = "/mnt/d/00.Projects/02.보탬e/site_analysis/output/menus"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def save_json(data, name):
    path = os.path.join(OUTPUT_DIR, f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved: {path}")
    return path

def save_screenshot(page, name):
    path = os.path.join(OUTPUT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=False)
    return path

def login(page):
    """로그인 수행"""
    print("\n=== 로그인 ===")
    page.goto(BASE_URL, timeout=30000)
    page.wait_for_load_state('networkidle')

    # 아이디 로그인 탭
    page.locator('text=아이디 로그인').click()
    page.wait_for_timeout(500)

    # 입력
    page.locator('input[type="text"].cl-text').fill(CREDENTIALS['user_id'])
    page.locator('input[type="password"].cl-text').fill(CREDENTIALS['password'])

    # 로그인 버튼
    page.locator('.btn-login:visible >> text=로그인').click()
    page.wait_for_timeout(3000)

    print("로그인 완료")
    return True

def extract_menu_structure(page):
    """좌측 메뉴 구조 추출"""
    print("\n=== 메뉴 구조 추출 ===")

    menu_structure = page.evaluate("""
        () => {
            const menus = [];

            // 좌측 사이드바 메뉴
            document.querySelectorAll('.cl-control').forEach(el => {
                const text = el.innerText?.trim();
                const id = el.id;

                // 메뉴 항목으로 보이는 것들
                if (text && text.length < 50 && !text.includes('\\n')) {
                    const rect = el.getBoundingClientRect();
                    if (rect.left < 200 && rect.width > 0 && rect.height > 0) {
                        menus.push({
                            text: text,
                            id: id,
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        });
                    }
                }
            });

            return menus;
        }
    """)

    # 중복 제거 및 정리
    seen = set()
    unique_menus = []
    for m in menu_structure:
        if m['text'] not in seen and len(m['text']) > 1:
            seen.add(m['text'])
            unique_menus.append(m)

    save_json(unique_menus, "sidebar_menus_raw")
    return unique_menus

def click_menu_and_capture(page, menu_text, menu_index):
    """메뉴 클릭 후 화면 캡처 및 요소 추출"""
    print(f"\n--- {menu_text} ---")

    try:
        # 메뉴 클릭
        menu_item = page.locator(f'text={menu_text}').first
        if menu_item.is_visible():
            menu_item.click()
            page.wait_for_timeout(1500)

            # 스크린샷
            save_screenshot(page, f"{menu_index:02d}_{menu_text.replace(' ', '_')}")

            # 서브메뉴 확인
            submenus = page.evaluate("""
                () => {
                    const items = [];
                    // 펼쳐진 서브메뉴 찾기
                    document.querySelectorAll('.cl-control, .cl-treeitem, [role="treeitem"], [role="menuitem"]').forEach(el => {
                        const text = el.innerText?.trim();
                        const rect = el.getBoundingClientRect();
                        // 좌측 메뉴 영역에서 보이는 항목
                        if (text && rect.left < 250 && rect.width > 0 && rect.height > 0 && rect.height < 50) {
                            items.push({
                                text: text,
                                id: el.id,
                                class: el.className,
                                top: rect.top
                            });
                        }
                    });
                    return items;
                }
            """)

            return {
                'menu': menu_text,
                'submenus': submenus,
                'screenshot': f"{menu_index:02d}_{menu_text.replace(' ', '_')}.png"
            }

    except Exception as e:
        print(f"  오류: {e}")
        return None

def explore_all_menus(page):
    """모든 메뉴 탐색"""
    print("\n=== 전체 메뉴 탐색 ===")

    # 메인 메뉴 목록 (스크린샷에서 확인된 순서)
    main_menus = [
        "즐겨찾기",
        "보조사업선정",
        "교부관리",
        "사업수행관리",
        "정보공시관리",
        "금융정보관리",
        "사용자지원"
    ]

    all_menus = {}

    for idx, menu in enumerate(main_menus, 1):
        result = click_menu_and_capture(page, menu, idx)
        if result:
            all_menus[menu] = result

        page.wait_for_timeout(500)

    save_json(all_menus, "all_menus_structure")
    return all_menus

def extract_page_elements(page, page_name):
    """페이지의 입력 요소 추출"""
    elements = page.evaluate("""
        () => {
            const result = {
                inputs: [],
                selects: [],
                buttons: [],
                tables: [],
                grids: []
            };

            // Input
            document.querySelectorAll('input:not([type="hidden"])').forEach(el => {
                if (el.offsetParent !== null) {
                    result.inputs.push({
                        type: el.type,
                        id: el.id,
                        name: el.name,
                        class: el.className,
                        placeholder: el.placeholder,
                        'aria-label': el.getAttribute('aria-label')
                    });
                }
            });

            // Select
            document.querySelectorAll('select, [role="combobox"], [role="listbox"]').forEach(el => {
                if (el.offsetParent !== null) {
                    result.selects.push({
                        id: el.id,
                        class: el.className,
                        'aria-label': el.getAttribute('aria-label')
                    });
                }
            });

            // Button
            document.querySelectorAll('button, [role="button"], .cl-button').forEach(el => {
                if (el.offsetParent !== null) {
                    result.buttons.push({
                        text: el.innerText?.trim(),
                        id: el.id,
                        class: el.className
                    });
                }
            });

            // Table/Grid
            document.querySelectorAll('table, [role="grid"], .cl-grid').forEach(el => {
                if (el.offsetParent !== null) {
                    result.tables.push({
                        id: el.id,
                        class: el.className,
                        rows: el.querySelectorAll('tr, [role="row"]').length
                    });
                }
            });

            return result;
        }
    """)

    return elements

def navigate_to_key_screens(page):
    """주요 화면으로 이동하여 요소 추출"""
    print("\n=== 주요 화면 요소 추출 ===")

    key_screens = {}

    # 매뉴얼에서 파악한 주요 화면들
    screens_to_check = [
        ("사업수행관리", "집행관리"),
        ("사업수행관리", "집행등록"),
        ("금융정보관리", "카드사용내역"),
    ]

    for main_menu, sub_menu in screens_to_check:
        try:
            print(f"\n탐색: {main_menu} > {sub_menu}")

            # 메인 메뉴 클릭
            page.locator(f'text={main_menu}').first.click()
            page.wait_for_timeout(1000)

            # 서브 메뉴 클릭 시도
            try:
                page.locator(f'text={sub_menu}').first.click()
                page.wait_for_timeout(2000)

                # 요소 추출
                elements = extract_page_elements(page, f"{main_menu}_{sub_menu}")
                key_screens[f"{main_menu}_{sub_menu}"] = elements

                # 스크린샷
                save_screenshot(page, f"screen_{main_menu}_{sub_menu}")

                print(f"  Inputs: {len(elements['inputs'])}")
                print(f"  Buttons: {len(elements['buttons'])}")

            except:
                print(f"  서브메뉴 '{sub_menu}' 찾지 못함")

        except Exception as e:
            print(f"  오류: {e}")

    save_json(key_screens, "key_screens_elements")
    return key_screens

def main():
    print("=" * 60)
    print("보탬e 메뉴 구조 탐색")
    print(f"시작: {datetime.now()}")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR'
        )
        page = context.new_page()

        # dialog 핸들러
        page.on('dialog', lambda d: d.accept())

        try:
            # 1. 로그인
            login(page)
            save_screenshot(page, "00_main_after_login")

            # 2. 메뉴 구조 추출
            menus = extract_menu_structure(page)
            print(f"발견된 메뉴 항목: {len(menus)}개")

            # 3. 전체 메뉴 탐색
            all_menus = explore_all_menus(page)

            # 4. 주요 화면 요소 추출
            key_screens = navigate_to_key_screens(page)

        except Exception as e:
            print(f"\n오류: {e}")
            save_screenshot(page, "error")
            raise

        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("완료")
    print(f"결과: {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
