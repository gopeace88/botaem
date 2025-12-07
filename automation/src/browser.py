"""브라우저 관리 모듈"""
import asyncio
from typing import Optional
from playwright.async_api import async_playwright, Browser, Page, BrowserContext
from loguru import logger

from .config import config


class BrowserManager:
    """Playwright 브라우저 관리자"""

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    async def start(self) -> Page:
        """브라우저 시작"""
        logger.info("브라우저 시작...")

        self.playwright = await async_playwright().start()

        # 브라우저 실행
        self.browser = await self.playwright.chromium.launch(
            headless=config.is_headless,
            slow_mo=config.slow_mo
        )

        # 컨텍스트 생성
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR'
        )

        # 페이지 생성
        self.page = await self.context.new_page()

        # 타임아웃 설정
        self.page.set_default_timeout(config.get('botame.timeout', 30000))

        logger.info("브라우저 시작 완료")
        return self.page

    async def stop(self):
        """브라우저 종료"""
        logger.info("브라우저 종료...")

        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

        logger.info("브라우저 종료 완료")

    async def screenshot(self, name: str):
        """스크린샷 저장"""
        if self.page:
            path = f"logs/screenshots/{name}.png"
            await self.page.screenshot(path=path)
            logger.debug(f"스크린샷 저장: {path}")

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()
