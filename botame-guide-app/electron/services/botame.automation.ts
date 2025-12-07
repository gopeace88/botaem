/**
 * 보탬e 웹사이트 자동화 서비스
 * Playwright를 사용하여 지방보조금관리시스템(보탬e) 웹을 제어
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';

// Persistent user data directory for browser sessions
const USER_DATA_DIR = path.join(os.homedir(), '.config', 'botame-guide-app', 'browser-data');

export interface LoginCredentials {
  userId: string;
  password: string;
  certPassword?: string; // 공동인증서 비밀번호
}

export interface AutomationResult {
  success: boolean;
  message?: string;
  data?: unknown;
  screenshot?: string;
  error?: string;
}

export interface ElementInfo {
  selector: string;
  text?: string;
  value?: string;
  visible: boolean;
}

export interface PageState {
  url: string;
  title: string;
  elements: ElementInfo[];
}

export class BotameAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = 'https://www.losims.go.kr/lss.do') {
    this.baseUrl = baseUrl;
  }

  /**
   * 브라우저 초기화
   * launchPersistentContext를 사용하여 로그인 세션을 유지
   */
  async initialize(): Promise<AutomationResult> {
    try {
      // Use persistent context to preserve login sessions
      this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false, // 사용자가 볼 수 있도록 GUI 모드
        args: ['--window-size=1280,900'],
        viewport: { width: 1280, height: 800 }, // 고정 크기로 스크롤바 표시
        locale: 'ko-KR',
      });

      // Get the first page or create a new one
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

      // Store browser reference for compatibility (context.browser() returns the browser)
      this.browser = this.context.browser();

      console.log('[Automation] Browser initialized with persistent context at:', USER_DATA_DIR);
      return { success: true, message: '브라우저가 초기화되었습니다. (세션 유지됨)' };
    } catch (error) {
      console.error('[Automation] Browser initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '브라우저 초기화 실패',
      };
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * 보탬e 메인 페이지로 이동
   */
  async navigateToMain(): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      console.log('[Automation] Navigating to:', this.baseUrl);
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      console.log('[Automation] Navigation complete, current URL:', this.page.url());
      return { success: true, message: '보탬e 메인 페이지로 이동했습니다.' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '페이지 이동 실패',
      };
    }
  }

  /**
   * 특정 URL로 이동
   */
  async navigateTo(url: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      return { success: true, message: `${url}로 이동했습니다.` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '페이지 이동 실패',
      };
    }
  }

  /**
   * 로그인 수행
   */
  async login(credentials: LoginCredentials): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      // 로그인 페이지로 이동 (보탬e의 실제 로그인 URL로 수정 필요)
      await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle' });

      // 아이디 입력
      await this.page.fill('input[name="userId"], #userId, input[type="text"]', credentials.userId);

      // 비밀번호 입력
      await this.page.fill('input[name="password"], #password, input[type="password"]', credentials.password);

      // 로그인 버튼 클릭
      await this.page.click('button[type="submit"], .login-btn, #loginBtn');

      // 로그인 완료 대기
      await this.page.waitForNavigation({ waitUntil: 'networkidle' });

      // 로그인 성공 여부 확인
      const currentUrl = this.page.url();
      if (currentUrl.includes('login') || currentUrl.includes('error')) {
        return { success: false, error: '로그인에 실패했습니다. 아이디와 비밀번호를 확인하세요.' };
      }

      return { success: true, message: '로그인에 성공했습니다.' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '로그인 처리 중 오류 발생',
      };
    }
  }

  /**
   * 특정 메뉴로 이동
   */
  async navigateToMenu(menuPath: string[]): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      for (const menuItem of menuPath) {
        // 메뉴 항목 찾기 및 클릭
        const menuSelector = `text="${menuItem}", a:has-text("${menuItem}"), span:has-text("${menuItem}")`;
        await this.page.click(menuSelector);
        await this.page.waitForTimeout(500); // 메뉴 애니메이션 대기
      }

      await this.page.waitForLoadState('networkidle');
      return { success: true, message: `${menuPath.join(' > ')} 메뉴로 이동했습니다.` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '메뉴 이동 실패',
      };
    }
  }

  /**
   * 요소 클릭
   */
  async clickElement(selector: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.click(selector);
      return { success: true, message: `요소를 클릭했습니다: ${selector}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '요소 클릭 실패',
      };
    }
  }

  /**
   * 텍스트 입력
   */
  async fillInput(selector: string, value: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.fill(selector, value);
      return { success: true, message: `값을 입력했습니다: ${selector}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '입력 실패',
      };
    }
  }

  /**
   * 드롭다운 선택
   */
  async selectOption(selector: string, value: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.selectOption(selector, value);
      return { success: true, message: `옵션을 선택했습니다: ${value}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '옵션 선택 실패',
      };
    }
  }

  /**
   * 현재 페이지 상태 가져오기
   */
  async getPageState(): Promise<PageState | null> {
    if (!this.page) {
      return null;
    }

    const url = this.page.url();
    const title = await this.page.title();

    // 주요 입력 요소들의 정보 수집
    const elements: ElementInfo[] = [];

    // 입력 필드 수집
    const inputs = await this.page.$$('input:visible, select:visible, textarea:visible');
    for (const input of inputs) {
      const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const value = await input.inputValue().catch(() => '');

      elements.push({
        selector: id ? `#${id}` : name ? `[name="${name}"]` : tagName,
        text: placeholder || '',
        value,
        visible: true,
      });
    }

    // 버튼 수집
    const buttons = await this.page.$$('button:visible, input[type="submit"]:visible, input[type="button"]:visible');
    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const id = await button.getAttribute('id');

      elements.push({
        selector: id ? `#${id}` : `button:has-text("${text?.trim()}")`,
        text: text?.trim() || '',
        visible: true,
      });
    }

    return { url, title, elements };
  }

  /**
   * 스크린샷 캡처
   */
  async captureScreenshot(filename?: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      const screenshotPath = filename || `screenshot-${Date.now()}.png`;
      const buffer = await this.page.screenshot({ path: screenshotPath, fullPage: true });

      return {
        success: true,
        message: '스크린샷을 캡처했습니다.',
        screenshot: screenshotPath,
        data: buffer.toString('base64'),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '스크린샷 캡처 실패',
      };
    }
  }

  /**
   * 특정 텍스트가 있는 요소 찾기
   */
  async findElementByText(text: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      const element = await this.page.$(`text="${text}"`);
      if (element) {
        return {
          success: true,
          message: `요소를 찾았습니다: ${text}`,
          data: { found: true },
        };
      }
      return {
        success: false,
        error: `요소를 찾을 수 없습니다: ${text}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '요소 검색 실패',
      };
    }
  }

  /**
   * 페이지 로드 대기
   */
  async waitForPageLoad(): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.waitForLoadState('networkidle');
      return { success: true, message: '페이지 로드가 완료되었습니다.' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '페이지 로드 대기 실패',
      };
    }
  }

  /**
   * 특정 요소가 나타날 때까지 대기
   */
  async waitForElement(selector: string, timeout = 10000): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.waitForSelector(selector, { timeout });
      return { success: true, message: `요소가 나타났습니다: ${selector}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '요소 대기 시간 초과',
      };
    }
  }

  /**
   * JavaScript 코드 실행
   */
  async evaluateScript(script: string): Promise<AutomationResult> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      const result = await this.page.evaluate(script);
      return {
        success: true,
        message: '스크립트가 실행되었습니다.',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '스크립트 실행 실패',
      };
    }
  }

  /**
   * 현재 URL 가져오기
   */
  getCurrentUrl(): string | null {
    return this.page?.url() ?? null;
  }

  /**
   * 브라우저 상태 확인
   */
  isInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Playwright Page 인스턴스 가져오기
   * StepVerifier에서 검증에 사용
   */
  getPage(): Page | null {
    return this.page;
  }
}

// Singleton instance
export const botameAutomation = new BotameAutomation();
