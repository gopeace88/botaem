"""
보탬e 공개 페이지 분석 (로그인 불필요)
- 홍보 포털 메뉴 구조
- 로그인 페이지 상세 DOM 분석
"""

import json
import os
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.losims.go.kr"
OUTPUT_DIR = "/mnt/d/00.Projects/02.보탬e/site_analysis/output/public"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def save_json(data, name):
    path = os.path.join(OUTPUT_DIR, f"{name}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved: {path}")
    return path

def save_screenshot(page, name):
    path = os.path.join(OUTPUT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"Screenshot: {path}")
    return path

def analyze_login_page_detail(page):
    """로그인 페이지 상세 DOM 분석"""
    print("\n=== 로그인 페이지 상세 분석 ===")

    page.goto(f"{BASE_URL}/lss.do", timeout=30000)
    page.wait_for_load_state('networkidle')

    save_screenshot(page, "login_cert_tab")

    # 아이디 로그인 탭 클릭
    page.locator('text=아이디 로그인').click()
    page.wait_for_timeout(1000)
    save_screenshot(page, "login_id_tab")

    # 전체 HTML 구조 저장
    html_content = page.content()
    with open(os.path.join(OUTPUT_DIR, "login_page.html"), 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("Login page HTML saved")

    # 로그인 폼 상세 분석
    login_form_info = page.evaluate("""
        () => {
            const info = {
                inputs: [],
                buttons: [],
                forms: [],
                scripts_with_login: []
            };

            // 모든 input 상세
            document.querySelectorAll('input').forEach(el => {
                info.inputs.push({
                    type: el.type,
                    id: el.id,
                    name: el.name,
                    class: el.className,
                    placeholder: el.placeholder,
                    value: el.value,
                    readonly: el.readOnly,
                    disabled: el.disabled,
                    visible: el.offsetParent !== null,
                    rect: el.getBoundingClientRect()
                });
            });

            // 모든 버튼/클릭 가능 요소
            document.querySelectorAll('button, a, [onclick], [role="button"]').forEach(el => {
                const text = el.innerText?.trim() || '';
                if (text.includes('로그인') || el.onclick) {
                    info.buttons.push({
                        tag: el.tagName,
                        text: text,
                        id: el.id,
                        class: el.className,
                        onclick: el.getAttribute('onclick'),
                        href: el.getAttribute('href'),
                        visible: el.offsetParent !== null
                    });
                }
            });

            // form 태그
            document.querySelectorAll('form').forEach(el => {
                info.forms.push({
                    id: el.id,
                    action: el.action,
                    method: el.method,
                    name: el.name
                });
            });

            return info;
        }
    """)

    save_json(login_form_info, "login_form_detail")
    print(f"Inputs: {len(login_form_info['inputs'])}")
    print(f"Buttons with login: {len(login_form_info['buttons'])}")

    return login_form_info

def analyze_portal_pages(page):
    """홍보 포털 페이지 분석"""
    print("\n=== 홍보 포털 분석 ===")

    page.goto(f"{BASE_URL}/sp", timeout=30000)
    page.wait_for_load_state('networkidle')

    save_screenshot(page, "portal_main")

    # 메뉴 구조 추출
    menu_structure = page.evaluate("""
        () => {
            const menus = [];

            // 헤더 네비게이션
            document.querySelectorAll('nav a, .gnb a, header a').forEach(el => {
                const href = el.getAttribute('href');
                const text = el.innerText?.trim();
                if (href && text && !href.startsWith('javascript:')) {
                    menus.push({
                        text: text,
                        href: href,
                        parent: el.closest('li, nav, .menu')?.className || null
                    });
                }
            });

            return menus;
        }
    """)

    # 중복 제거
    unique_menus = []
    seen = set()
    for m in menu_structure:
        key = (m['text'], m['href'])
        if key not in seen and m['text']:
            seen.add(key)
            unique_menus.append(m)

    save_json(unique_menus, "portal_menu_structure")
    print(f"Portal menus: {len(unique_menus)}")

    # 주요 페이지 목록
    pages_to_analyze = [
        '/sp/lsaInfo',      # 지방보조금이란
        '/sp/funcIntrcn',   # 시스템 및 주요기능
        '/sp/usrMual',      # 사용자매뉴얼
        '/sp/pbcnBizSrch',  # 공모사업 검색
    ]

    page_analyses = {}
    for page_url in pages_to_analyze:
        try:
            print(f"\n분석 중: {page_url}")
            page.goto(f"{BASE_URL}{page_url}", timeout=30000)
            page.wait_for_load_state('networkidle')

            page_name = page_url.replace('/sp/', '').replace('/', '_')
            save_screenshot(page, f"portal_{page_name}")

            # 페이지 내용 요약
            content = page.evaluate("""
                () => {
                    return {
                        title: document.title,
                        h1: Array.from(document.querySelectorAll('h1')).map(e => e.innerText?.trim()),
                        h2: Array.from(document.querySelectorAll('h2')).map(e => e.innerText?.trim()),
                        links: Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(e => ({
                            text: e.innerText?.trim(),
                            href: e.getAttribute('href')
                        }))
                    };
                }
            """)

            page_analyses[page_url] = content

        except Exception as e:
            print(f"  오류: {e}")

    save_json(page_analyses, "portal_pages_content")

    return unique_menus, page_analyses

def main():
    print("=" * 60)
    print("보탬e 공개 페이지 분석")
    print(f"시작: {datetime.now()}")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR'
        )
        page = context.new_page()

        try:
            # 1. 로그인 페이지 상세 분석
            login_info = analyze_login_page_detail(page)

            # 2. 홍보 포털 분석
            menus, pages = analyze_portal_pages(page)

        except Exception as e:
            print(f"\n오류: {e}")
            save_screenshot(page, "error")

        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("분석 완료")
    print(f"결과: {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
