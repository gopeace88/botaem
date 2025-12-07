const { chromium } = require('playwright');

(async () => {
  console.log('=== 전체 자동 로그인 + 가입자정보 테스트 ===\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR'
  });

  const page = await context.newPage();

  try {
    // Step 1: 사이트 접속
    console.log('1. 보탬e 사이트 접속...');
    await page.goto('https://www.losims.go.kr/lss.do');
    await page.waitForLoadState('networkidle');
    console.log('   현재 URL:', page.url());

    // Step 2: 로그인 상태 확인
    console.log('\n2. 로그인 상태 확인...');
    const alreadyLoggedIn = await page.locator('text=알티케이').isVisible({ timeout: 3000 }).catch(() => false);

    if (alreadyLoggedIn) {
      console.log('   이미 로그인됨 (알티케이 표시됨)');
    } else {
      console.log('   로그인 필요 - 자동 로그인 시작...');

      // 아이디 로그인 탭 클릭
      console.log('   - 아이디 로그인 탭 클릭');
      await page.locator('text=아이디 로그인').click();
      await page.waitForTimeout(1000);

      // 페이지 HTML 분석 - 로그인 버튼 찾기
      console.log('   - 로그인 버튼 분석...');
      const loginElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const results = [];
        elements.forEach((el, idx) => {
          const text = el.textContent?.trim();
          if (text === '로그인' && el.tagName) {
            results.push({
              idx,
              tag: el.tagName,
              class: el.className,
              id: el.id,
              type: el.type || '',
              parentTag: el.parentElement?.tagName,
              parentClass: el.parentElement?.className
            });
          }
        });
        return results;
      });
      console.log('   - "로그인" 정확히 일치하는 요소:', JSON.stringify(loginElements, null, 2));

      // 아이디 입력
      console.log('   - 아이디 입력: gopeace');
      await page.locator("input[type='text']").first().fill('gopeace');

      // 비밀번호 입력
      console.log('   - 비밀번호 입력');
      await page.locator("input[type='password']").fill('gopeace123!');

      // 스크린샷
      await page.screenshot({ path: '/tmp/test-before-login.png' });
      console.log('   - 로그인 전 스크린샷: /tmp/test-before-login.png');

      // 로그인 버튼 클릭 - getByRole 사용 (가장 정확)
      console.log('   - 로그인 버튼 클릭 (getByRole button)...');
      await page.getByRole('button', { name: '로그인 버튼' }).click();
      console.log('   - 로그인 버튼 클릭 완료');

      // 로그인 완료 대기
      console.log('   - 로그인 처리 대기...');
      await page.waitForTimeout(3000);

      // 로그인 성공 확인
      const loginSuccess = await page.locator('text=알티케이').isVisible({ timeout: 5000 }).catch(() => false);
      if (loginSuccess) {
        console.log('   로그인 성공!');
      } else {
        console.log('   로그인 실패 - 화면 확인 필요');
        await page.screenshot({ path: '/tmp/test-login-failed.png' });
        throw new Error('로그인 실패');
      }
    }

    // Step 3: 사용자 이름 클릭 (드롭다운 열기)
    console.log('\n3. 사용자 이름 클릭 (드롭다운 열기)...');
    await page.locator('text=알티케이').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/test-dropdown-opened.png' });
    console.log('   드롭다운 열림 스크린샷: /tmp/test-dropdown-opened.png');

    // Step 4: 사용자정보관리 메뉴 클릭
    console.log('\n4. 사용자정보관리 메뉴 클릭...');
    await page.locator('text=사용자정보관리').click();
    await page.waitForTimeout(2000);

    // Step 5: 가입자정보 화면 확인
    console.log('\n5. 가입자정보 화면 확인...');
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    console.log('   현재 URL:', currentUrl);

    // 화면 스크린샷
    await page.screenshot({ path: '/tmp/test-userinfo-final.png' });
    console.log('   최종 화면 스크린샷: /tmp/test-userinfo-final.png');

    // 페이지 내용 확인
    const pageContent = await page.content();
    const hasUserInfo = pageContent.includes('사용자정보') ||
                        pageContent.includes('가입자정보') ||
                        pageContent.includes('회원정보') ||
                        pageContent.includes('gopeace');

    if (hasUserInfo) {
      console.log('   가입자정보 화면 확인됨!');
    } else {
      console.log('   페이지 내용 확인 필요');
    }

    console.log('\n===========================================');
    console.log('테스트 완료!');
    console.log('===========================================');

    // 브라우저를 5초간 유지 (확인용)
    console.log('\n브라우저를 5초간 유지합니다...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('\n테스트 실패:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png' });
    console.log('에러 스크린샷: /tmp/test-error.png');
  } finally {
    await browser.close();
    console.log('\n브라우저 종료됨');
  }
})();
