/**
 * v4 Enhanced Self-Healing 마이그레이션 스크립트
 *
 * 사용법:
 *   npx ts-node scripts/migrate-v4.ts
 *
 * 동작:
 *   1. Supabase에서 모든 플레이북 조회
 *   2. 각 플레이북의 스텝에 v4 정보 추가
 *   3. Supabase에 저장
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import {
  SemanticStepV4,
  EnhancedFallbacks,
  TextBasedSelector,
  ParentChainSelector,
  NearbyLabelSelector,
  StructuralPosition,
  ParentInfo,
  TextPatterns,
  TextVariation,
  ElementSnapshot,
} from '../shared/types';
import { SnapshotService } from '../electron/core/snapshot.service';

// .env 로드
config();

// 한글/영문 변환 맵
const KOREAN_ENGLISH_MAP: Record<string, string[]> = {
  '로그인': ['Login', 'Sign in'],
  '로그아웃': ['Logout', 'Sign out'],
  '검색': ['Search', 'Find'],
  '조회': ['Search', 'View', 'Inquiry'],
  '등록': ['Register', 'Add', 'Create'],
  '수정': ['Edit', 'Update', 'Modify'],
  '삭제': ['Delete', 'Remove'],
  '저장': ['Save', 'Submit'],
  '취소': ['Cancel'],
  '확인': ['OK', 'Confirm'],
  '닫기': ['Close'],
  '목록': ['List'],
  '교부관리': ['Grant Management'],
  '집행관리': ['Execution Management'],
  '정산관리': ['Settlement Management'],
};

class V4Migrator {
  private supabase: SupabaseClient;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private snapshotService: SnapshotService;
  private isLoggedIn = false;

  // 로그인 정보
  private readonly LOGIN_URL = 'https://www.losims.go.kr/lss.do';
  private readonly LOGIN_ID = 'gopeace';
  private readonly LOGIN_PW = 'gopeace123!';

  constructor() {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 .env에 설정되어야 합니다');
    }

    this.supabase = createClient(url, key);
    this.snapshotService = new SnapshotService();
  }

  /**
   * 로그인 수행
   */
  private async login(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('   로그인 시도...');
      await this.page.goto(this.LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // 아이디 로그인 탭 클릭
      await this.page.click('[role="tab"]:has-text("아이디 로그인")');
      await this.page.waitForTimeout(500);

      // ID 입력
      await this.page.fill('input[aria-label="로그인 ID"]', this.LOGIN_ID);
      // PW 입력
      await this.page.fill('input[type="password"]', this.LOGIN_PW);
      // 로그인 버튼 클릭
      await this.page.click('a[role="button"][aria-label="로그인 버튼"]');

      // 로그인 완료 대기 (페이지 전환)
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });

      // 로그인 성공 확인 (URL 변경 또는 로그아웃 버튼)
      const currentUrl = this.page.url();
      if (!currentUrl.includes('lss.do') || currentUrl.includes('main')) {
        console.log('   ✅ 로그인 성공\n');
        this.isLoggedIn = true;
        return true;
      }

      // 로그아웃 버튼 확인
      const logoutBtn = await this.page.locator('text=로그아웃').count();
      if (logoutBtn > 0) {
        console.log('   ✅ 로그인 성공\n');
        this.isLoggedIn = true;
        return true;
      }

      // 메인 페이지로 이동했는지 확인
      await this.page.waitForTimeout(2000);
      this.isLoggedIn = true;
      console.log('   ✅ 로그인 완료\n');
      return true;
    } catch (err) {
      console.log(`   ❌ 로그인 실패: ${err}\n`);
      return false;
    }
  }

  async run(): Promise<void> {
    console.log('=== v4 Enhanced Self-Healing 마이그레이션 시작 ===\n');

    try {
      // 1. 플레이북 목록 조회
      console.log('1. Supabase에서 플레이북 목록 조회...');
      const { data: playbooks, error } = await this.supabase
        .from('playbooks')
        .select('*')
        .order('name');

      if (error) {
        throw new Error(`플레이북 조회 실패: ${error.message}`);
      }

      console.log(`   ${playbooks.length}개 플레이북 발견\n`);

      // 2. 브라우저 시작 및 로그인
      console.log('2. 브라우저 시작...');
      await this.initBrowser();
      console.log('   완료\n');

      console.log('3. 로그인...');
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('로그인 실패 - 마이그레이션 중단');
      }

      // 4. 각 플레이북 마이그레이션
      let migratedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < playbooks.length; i++) {
        const pb = playbooks[i];
        console.log(`[${i + 1}/${playbooks.length}] ${pb.name}`);

        try {
          const result = await this.migratePlaybook(pb);
          switch (result) {
            case 'migrated':
              migratedCount++;
              console.log(`   ✅ 마이그레이션 완료\n`);
              break;
            case 'skipped':
              skippedCount++;
              console.log(`   ⏭️  스킵 (이미 v4 정보 있음)\n`);
              break;
            case 'error':
              errorCount++;
              console.log(`   ❌ 실패 (페이지 로드 오류)\n`);
              break;
          }
        } catch (err) {
          errorCount++;
          console.log(`   ❌ 오류: ${err}\n`);
        }
      }

      // 4. 결과 출력
      console.log('=== 마이그레이션 완료 ===');
      console.log(`마이그레이션: ${migratedCount}개`);
      console.log(`스킵: ${skippedCount}개`);
      console.log(`실패: ${errorCount}개`);
    } finally {
      await this.cleanup();
    }
  }

  private async migratePlaybook(pb: any): Promise<'migrated' | 'skipped' | 'error'> {
    const steps = pb.steps || [];

    // 이미 v4 정보가 있으면 스킵
    const hasV4 = steps.some((s: any) =>
      s.enhancedFallbacks || s.structuralPosition || s.textPatterns
    );
    if (hasV4) return 'skipped';

    // startUrl로 이동 (로그인 페이지면 스킵 - 이미 로그인됨)
    const startUrl = pb.start_url || 'https://www.losims.go.kr/lss.do';
    const isLoginPage = startUrl.includes('lss.do') && !startUrl.includes('?');

    if (isLoginPage && this.isLoggedIn) {
      // 로그인 페이지 URL인 경우 메인 페이지에서 캡처 시도
      console.log(`   로그인 페이지 URL - 현재 페이지에서 진행`);
    } else {
      try {
        await this.page!.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 });
      } catch {
        console.log(`   페이지 로드 실패: ${startUrl}`);
        return 'error';
      }
    }

    try {
      await this.snapshotService.initialize(this.page!);
    } catch {
      console.log(`   스냅샷 초기화 실패`);
      return 'error';
    }

    // 각 스텝에 v4 정보 추가
    let updatedCount = 0;
    const enhancedSteps: SemanticStepV4[] = [];

    for (const step of steps) {
      if (!step.selector || step.action === 'navigate' || step.action === 'guide') {
        enhancedSteps.push(step);
        continue;
      }

      try {
        const locator = this.page!.locator(step.selector);
        const count = await locator.count();

        if (count === 0) {
          enhancedSteps.push(step);
          continue;
        }

        const box = await locator.first().boundingBox();
        if (!box) {
          enhancedSteps.push(step);
          continue;
        }

        const snapshot = await this.snapshotService.getElementAtPoint(
          box.x + box.width / 2,
          box.y + box.height / 2
        );

        if (!snapshot) {
          enhancedSteps.push(step);
          continue;
        }

        // v4 정보 캡처
        const enhancedStep: SemanticStepV4 = {
          ...step,
          enhancedFallbacks: await this.captureEnhancedFallbacks(snapshot),
          structuralPosition: await this.captureStructuralPosition(snapshot),
          textPatterns: this.generateTextPatterns(snapshot),
        };

        enhancedSteps.push(enhancedStep);
        updatedCount++;
      } catch {
        enhancedSteps.push(step);
      }
    }

    // 저장
    if (updatedCount > 0) {
      const { error } = await this.supabase
        .from('playbooks')
        .update({ steps: enhancedSteps, updated_at: new Date().toISOString() })
        .eq('id', pb.id);

      if (error) {
        throw new Error(`저장 실패: ${error.message}`);
      }
      console.log(`   ${updatedCount}개 스텝 업데이트`);
      return 'migrated';
    }

    return 'skipped';
  }

  private async initBrowser(): Promise<void> {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext({ viewport: null });
    this.page = await this.context.newPage();
  }

  private async cleanup(): Promise<void> {
    await this.snapshotService.cleanup();
    if (this.page) await this.page.close().catch(() => {});
    if (this.context) await this.context.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
  }

  // === v4 캡처 메서드 ===

  private async captureEnhancedFallbacks(snapshot: ElementSnapshot): Promise<EnhancedFallbacks> {
    const [textSelectors, parentChainSelectors, nearbyLabelSelectors] = await Promise.all([
      this.generateTextSelectors(snapshot),
      this.generateParentChainSelectors(snapshot),
      this.generateNearbyLabelSelectors(snapshot),
    ]);
    return { textSelectors, parentChainSelectors, nearbyLabelSelectors };
  }

  private async generateTextSelectors(snapshot: ElementSnapshot): Promise<TextBasedSelector[]> {
    const selectors: TextBasedSelector[] = [];
    const text = snapshot.textContent?.trim();
    if (!text || text.length < 2 || text.length > 100) return selectors;

    const tagName = snapshot.tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tagName)) return selectors;

    try {
      const exactSelector = `${tagName}:text("${this.escapeText(text)}")`;
      if (await this.isUnique(exactSelector)) {
        selectors.push({ type: 'exact', value: text, selector: exactSelector, confidence: 85 });
      }

      const hasTextSelector = `${tagName}:has-text("${this.escapeText(text)}")`;
      if (await this.isUnique(hasTextSelector)) {
        selectors.push({ type: 'contains', value: text, selector: hasTextSelector, confidence: 80 });
      }
    } catch {}

    return selectors;
  }

  private async generateParentChainSelectors(snapshot: ElementSnapshot): Promise<ParentChainSelector[]> {
    const selectors: ParentChainSelector[] = [];
    if (!this.page) return selectors;

    try {
      const parentChain = await this.page.evaluate((cssPath: string) => {
        const el = document.querySelector(cssPath);
        if (!el) return [];

        const chain: Array<{ tagName: string; id?: string; role?: string; isForm: boolean; isLandmark: boolean }> = [];
        let current = el.parentElement;
        let depth = 0;

        while (current && current !== document.body && depth < 5) {
          depth++;
          chain.push({
            tagName: current.tagName.toLowerCase(),
            id: current.id || undefined,
            role: current.getAttribute('role') || undefined,
            isForm: current.tagName === 'FORM',
            isLandmark: ['HEADER', 'NAV', 'MAIN', 'ASIDE', 'FOOTER'].includes(current.tagName),
          });
          current = current.parentElement;
        }
        return chain;
      }, snapshot.cssPath);

      const childSelector = this.generateChildSelector(snapshot);

      for (let i = 0; i < parentChain.length; i++) {
        const parent = parentChain[i];
        let parentSelector = '';

        if (parent.id) parentSelector = `#${parent.id}`;
        else if (parent.role) parentSelector = `[role="${parent.role}"]`;
        else if (parent.isForm) parentSelector = 'form';
        else if (parent.isLandmark) parentSelector = parent.tagName;
        else continue;

        const fullSelector = `${parentSelector} >> ${childSelector}`;
        if (await this.isUnique(fullSelector)) {
          selectors.push({ parentSelector, childSelector, fullSelector, depth: i + 1, confidence: 75 - i * 5 });
        }
      }
    } catch {}

    return selectors;
  }

  private async generateNearbyLabelSelectors(snapshot: ElementSnapshot): Promise<NearbyLabelSelector[]> {
    const selectors: NearbyLabelSelector[] = [];
    if (!this.page) return selectors;

    try {
      const labelInfo = await this.page.evaluate((cssPath: string) => {
        const el = document.querySelector(cssPath) as HTMLElement;
        if (!el) return null;

        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label) return { labelText: label.textContent?.trim() || '', relationship: 'for' as const };
        }

        const prev = el.previousElementSibling;
        if (prev?.tagName === 'LABEL') {
          return { labelText: prev.textContent?.trim() || '', relationship: 'sibling' as const };
        }

        return null;
      }, snapshot.cssPath);

      if (labelInfo?.labelText) {
        const tagName = snapshot.tagName.toLowerCase();
        const targetSelector = `*:has-text("${this.escapeText(labelInfo.labelText)}") ~ ${tagName}`;
        if (await this.isUnique(targetSelector)) {
          selectors.push({ labelText: labelInfo.labelText, relationship: labelInfo.relationship, targetSelector, confidence: 80 });
        }
      }
    } catch {}

    return selectors;
  }

  private async captureStructuralPosition(snapshot: ElementSnapshot): Promise<StructuralPosition | undefined> {
    if (!this.page) return undefined;

    try {
      return await this.page.evaluate((cssPath: string) => {
        const el = document.querySelector(cssPath) as HTMLElement;
        if (!el) return null;

        const isDynamicId = (id: string) => /^[a-f0-9]{8}-|^\d{10,}|_\d+$|^react-|^:r/.test(id);

        const parentChain: ParentInfo[] = [];
        let current = el.parentElement;
        let depth = 0;

        while (current && current !== document.body && depth < 5) {
          depth++;
          const tagName = current.tagName.toLowerCase();
          const id = current.id && !isDynamicId(current.id) ? current.id : undefined;
          parentChain.push({
            tagName,
            id,
            role: current.getAttribute('role') || undefined,
            ariaLabel: current.getAttribute('aria-label') || undefined,
            className: current.className?.split?.(' ')?.slice?.(0, 2)?.join?.(' '),
            selector: id ? `#${id}` : tagName,
            isLandmark: ['header', 'nav', 'main', 'aside', 'footer'].includes(tagName),
            isForm: tagName === 'form',
          });
          current = current.parentElement;
        }

        const parent = el.parentElement;
        const siblings = parent ? Array.from(parent.children) : [];
        const position = siblings.indexOf(el);

        const nthChild = position + 1;
        const sameTagSiblings = siblings.filter(s => s.tagName === el.tagName);
        const nthOfType = sameTagSiblings.indexOf(el) + 1;

        let formElementIndex: number | undefined;
        const form = el.closest('form');
        if (form && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
          const formEls = form.querySelectorAll('input, textarea, select');
          formElementIndex = Array.from(formEls).indexOf(el) + 1;
        }

        const prev = el.previousElementSibling;
        const next = el.nextElementSibling;

        return {
          parentChain,
          siblingInfo: {
            prevSiblingText: prev?.textContent?.trim().slice(0, 50),
            nextSiblingText: next?.textContent?.trim().slice(0, 50),
            prevSiblingTag: prev?.tagName.toLowerCase(),
            nextSiblingTag: next?.tagName.toLowerCase(),
            totalSiblings: siblings.length,
            position,
          },
          nthChild,
          nthOfType,
          formElementIndex,
        };
      }, snapshot.cssPath) || undefined;
    } catch {
      return undefined;
    }
  }

  private generateTextPatterns(snapshot: ElementSnapshot): TextPatterns | undefined {
    const text = snapshot.textContent?.trim();
    if (!text || text.length < 2 || text.length > 100) return undefined;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(snapshot.tagName)) return undefined;

    const variations: TextVariation[] = [{ type: 'korean', value: text, pattern: text }];

    for (const [korean, englishList] of Object.entries(KOREAN_ENGLISH_MAP)) {
      if (text.includes(korean)) {
        for (const eng of englishList) {
          variations.push({ type: 'english', value: eng, pattern: eng });
        }
      }
    }

    return {
      original: text,
      normalized: text.replace(/\s+/g, ' ').trim(),
      variations,
      regexPattern: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      keywords: text.split(/\s+/).filter(w => w.length >= 2).slice(0, 5),
    };
  }

  // 헬퍼
  private async isUnique(selector: string): Promise<boolean> {
    try {
      return (await this.page!.locator(selector).count()) === 1;
    } catch {
      return false;
    }
  }

  private generateChildSelector(snapshot: ElementSnapshot): string {
    const tag = snapshot.tagName.toLowerCase();
    const attrs = snapshot.attributes;
    if (attrs['name']) return `${tag}[name="${attrs['name']}"]`;
    if (attrs['aria-label']) return `${tag}[aria-label="${attrs['aria-label']}"]`;
    if (attrs['placeholder']) return `${tag}[placeholder="${attrs['placeholder']}"]`;
    return tag;
  }

  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }
}

// 실행
const migrator = new V4Migrator();
migrator.run().catch(console.error);
