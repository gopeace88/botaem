"""보탬e 기본 자동화 모듈"""
from typing import Optional, List, Dict, Any
from playwright.async_api import Page
from loguru import logger

from .config import config
from .browser import BrowserManager
from .logger import AutomationLogger


class BotameAutomation:
    """보탬e 자동화 기본 클래스"""

    def __init__(self, automation_type: str):
        self.browser_manager = BrowserManager()
        self.page: Optional[Page] = None
        self.logger = AutomationLogger(automation_type)
        self.fiscal_year = config.fiscal_year
        self.project_code = config.project_code

    async def start(self):
        """브라우저 시작"""
        self.page = await self.browser_manager.start()

    async def stop(self):
        """브라우저 종료"""
        await self.browser_manager.stop()

    async def login(self) -> bool:
        """보탬e 로그인"""
        try:
            logger.info("로그인 시도...")

            # 보탬e 접속
            await self.page.goto(config.botame_url)
            await self.page.wait_for_load_state('networkidle')

            # 로그인 폼 확인 (셀렉터는 실제 화면에 맞게 수정 필요)
            # 아이디 입력
            await self.page.fill('input[name="userId"], input#userId, input[type="text"]', config.user_id)

            # 비밀번호 입력
            await self.page.fill('input[name="password"], input#password, input[type="password"]', config.password)

            # 로그인 버튼 클릭
            await self.page.click('button[type="submit"], button:has-text("로그인")')

            # 로그인 성공 확인 (메인 페이지 로딩 대기)
            await self.page.wait_for_load_state('networkidle')

            # 로그인 성공 여부 확인 (에러 메시지 없으면 성공)
            error_element = await self.page.query_selector('.error-message, .login-error')
            if error_element:
                error_text = await error_element.inner_text()
                logger.error(f"로그인 실패: {error_text}")
                return False

            logger.success("로그인 성공")
            return True

        except Exception as e:
            logger.error(f"로그인 중 오류: {e}")
            await self.browser_manager.screenshot("login_error")
            return False

    async def select_project(self, fiscal_year: str = None, project_code: str = None) -> bool:
        """보조사업 선택"""
        try:
            fy = fiscal_year or self.fiscal_year
            pc = project_code or self.project_code

            logger.info(f"보조사업 선택: {fy} / {pc}")

            # 회계연도 선택 (셀렉터는 실제 화면에 맞게 수정 필요)
            await self.page.select_option('select#fiscalYear, select[name="fiscalYear"]', fy)

            # 보조사업 선택
            await self.page.fill('input#projectCode, input[name="projectCode"]', pc)

            # 조회 버튼 클릭
            await self.page.click('button:has-text("조회"), button.search-btn')

            # 결과 대기
            await self.page.wait_for_load_state('networkidle')

            logger.success("보조사업 선택 완료")
            return True

        except Exception as e:
            logger.error(f"보조사업 선택 중 오류: {e}")
            await self.browser_manager.screenshot("select_project_error")
            return False

    async def navigate_to_menu(self, menu_path: List[str]) -> bool:
        """메뉴 이동"""
        try:
            logger.info(f"메뉴 이동: {' > '.join(menu_path)}")

            for menu in menu_path:
                # 메뉴 클릭 (셀렉터는 실제 화면에 맞게 수정 필요)
                await self.page.click(f'a:has-text("{menu}"), span:has-text("{menu}")')
                await self.page.wait_for_timeout(500)

            await self.page.wait_for_load_state('networkidle')
            logger.success(f"메뉴 이동 완료: {menu_path[-1]}")
            return True

        except Exception as e:
            logger.error(f"메뉴 이동 중 오류: {e}")
            await self.browser_manager.screenshot("navigate_error")
            return False

    def find_budget_mapping(self, vendor_name: str, business_type: str = "") -> Dict[str, str]:
        """비목/세목 매핑 찾기"""
        rules = config.budget_mapping_rules

        for rule in rules:
            # 업종 매칭
            if 'vendor_type' in rule and business_type:
                if rule['vendor_type'] in business_type:
                    return {
                        'item': rule['budget_item'],
                        'funding': rule['funding_type']
                    }

            # 거래처명 패턴 매칭
            if 'vendor_name_contains' in rule and vendor_name:
                if rule['vendor_name_contains'] in vendor_name:
                    return {
                        'item': rule['budget_item'],
                        'funding': rule['funding_type']
                    }

        # 기본값 반환
        default = config.default_budget
        return {
            'item': default.get('budget_item', '기타운영비'),
            'funding': default.get('funding_type', '시도비')
        }

    async def run(self) -> Dict[str, Any]:
        """자동화 실행 (서브클래스에서 구현)"""
        raise NotImplementedError("서브클래스에서 구현하세요")
