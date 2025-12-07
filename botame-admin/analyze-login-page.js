const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Try multiple possible URLs
    const urls = [
      'https://losims.go.kr/login',
      'https://losims.go.kr/index.html',
      'https://www.losims.go.kr',
      'https://www.losims.go.kr/login',
      'http://losims.go.kr'
    ];

    let success = false;
    for (const url of urls) {
      try {
        console.log(`Trying URL: ${url}`);
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        console.log('Response status:', response?.status());
        console.log('Waiting for page to load...');
        await page.waitForTimeout(5000);

        // Check if page has content
        const hasContent = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.length > 100 && !text.includes('Application is not available');
        });

        if (hasContent) {
          console.log('✓ Page loaded successfully');
          console.log('Current URL:', page.url());
          console.log('Page title:', await page.title());
          success = true;
          break;
        } else {
          console.log('✗ Page seems empty or unavailable');
        }
      } catch (error) {
        console.log(`✗ Failed to load ${url}:`, error.message);
      }
    }

    if (!success) {
      console.log('WARNING: Could not load a valid page. Analyzing what we have...');
    }

    // Try to wait for common login elements
    try {
      await page.waitForSelector('input', { timeout: 5000 });
      console.log('Input elements detected');
    } catch (e) {
      console.log('No input elements found, continuing...');
    }

    const analysisResult = {
      url: page.url(),
      timestamp: new Date().toISOString(),
      viewport: await page.viewportSize(),

      // 1. All interactive elements
      interactiveElements: [],

      // 2. Tab structure
      tabStructure: {},

      // 3. Login form structure
      loginForm: {},

      // 4. Accessibility tree
      accessibilityTree: null,

      // Additional page info
      pageInfo: {}
    };

    console.log('Analyzing interactive elements...');

    // Get all interactive elements
    const interactiveSelectors = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="tab"]',
      '[role="link"]',
      '[onclick]',
      '[tabindex]',
      'div',
      'span'
    ];

    const interactiveElements = await page.evaluate((selectors) => {
      console.log('Starting element analysis...');
      const elements = [];
      const processedElements = new Set();

      // First, get ALL elements in the document
      const allElements = document.querySelectorAll('*');
      console.log('Total elements in DOM:', allElements.length);

      selectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        console.log(`Found ${found.length} elements for selector: ${selector}`);
        found.forEach(el => {
          if (processedElements.has(el)) return;
          processedElements.add(el);

          const rect = el.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(el);

          elements.push({
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            className: el.className || null,
            type: el.type || null,
            name: el.name || null,
            value: el.value || null,
            placeholder: el.placeholder || null,
            textContent: el.textContent?.trim().substring(0, 100) || null,
            innerHTML: el.innerHTML?.substring(0, 200) || null,
            role: el.getAttribute('role') || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            ariaLabelledBy: el.getAttribute('aria-labelledby') || null,
            ariaSelected: el.getAttribute('aria-selected') || null,
            ariaHidden: el.getAttribute('aria-hidden') || null,
            tabIndex: el.tabIndex,
            href: el.href || null,
            onclick: el.onclick ? el.onclick.toString().substring(0, 100) : null,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left
            },
            isVisible: computedStyle.display !== 'none' &&
                       computedStyle.visibility !== 'hidden' &&
                       rect.width > 0 && rect.height > 0,
            computedDisplay: computedStyle.display,
            computedVisibility: computedStyle.visibility,
            xpath: getXPath(el)
          });
        });
      });

      function getXPath(element) {
        if (element.id !== '') {
          return 'id("' + element.id + '")';
        }
        if (element === document.body) {
          return element.tagName.toLowerCase();
        }

        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];

        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling === element) {
            const parentPath = element.parentNode ? getXPath(element.parentNode) : '';
            return parentPath + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
          }
          if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
          }
        }
      }

      return elements;
    }, interactiveSelectors);

    analysisResult.interactiveElements = interactiveElements;
    console.log(`Found ${interactiveElements.length} interactive elements`);

    // Analyze tab structure
    console.log('Analyzing tab structure...');
    const tabStructure = await page.evaluate(() => {
      const tabs = {
        containers: [],
        tabs: [],
        panels: []
      };

      // Find tab containers
      const tabContainers = document.querySelectorAll('[role="tablist"], .tab-container, .tabs, .nav-tabs');
      tabContainers.forEach(container => {
        const rect = container.getBoundingClientRect();
        tabs.containers.push({
          tagName: container.tagName.toLowerCase(),
          className: container.className,
          role: container.getAttribute('role'),
          innerHTML: container.innerHTML.substring(0, 500),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });

      // Find all tabs
      const tabElements = document.querySelectorAll('[role="tab"], .tab, .nav-tab, [class*="tab"]');
      tabElements.forEach(tab => {
        const rect = tab.getBoundingClientRect();
        tabs.tabs.push({
          tagName: tab.tagName.toLowerCase(),
          id: tab.id || null,
          className: tab.className,
          textContent: tab.textContent?.trim(),
          role: tab.getAttribute('role'),
          ariaSelected: tab.getAttribute('aria-selected'),
          ariaControls: tab.getAttribute('aria-controls'),
          isActive: tab.classList?.contains('active') ||
                    tab.classList?.contains('selected') ||
                    tab.getAttribute('aria-selected') === 'true',
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          onclick: tab.onclick ? tab.onclick.toString() : null
        });
      });

      // Find tab panels
      const panelElements = document.querySelectorAll('[role="tabpanel"], .tab-panel, .tab-content');
      panelElements.forEach(panel => {
        const rect = panel.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(panel);
        tabs.panels.push({
          tagName: panel.tagName.toLowerCase(),
          id: panel.id || null,
          className: panel.className,
          role: panel.getAttribute('role'),
          ariaLabelledBy: panel.getAttribute('aria-labelledby'),
          isVisible: computedStyle.display !== 'none' &&
                     computedStyle.visibility !== 'hidden',
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });

      return tabs;
    });

    analysisResult.tabStructure = tabStructure;
    console.log(`Found ${tabStructure.tabs.length} tabs`);

    // Analyze login form
    console.log('Analyzing login form...');
    const loginForm = await page.evaluate(() => {
      const form = {
        forms: [],
        inputs: [],
        buttons: [],
        labels: []
      };

      // Find all forms
      document.querySelectorAll('form').forEach(f => {
        const rect = f.getBoundingClientRect();
        form.forms.push({
          tagName: 'form',
          id: f.id || null,
          className: f.className,
          action: f.action,
          method: f.method,
          name: f.name || null,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          innerHTML: f.innerHTML.substring(0, 1000)
        });
      });

      // Find all input fields
      document.querySelectorAll('input').forEach(input => {
        const rect = input.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(input);
        form.inputs.push({
          tagName: 'input',
          id: input.id || null,
          className: input.className,
          type: input.type,
          name: input.name || null,
          placeholder: input.placeholder || null,
          value: input.value || null,
          autocomplete: input.autocomplete || null,
          required: input.required,
          disabled: input.disabled,
          readonly: input.readOnly,
          maxLength: input.maxLength !== -1 ? input.maxLength : null,
          ariaLabel: input.getAttribute('aria-label'),
          ariaRequired: input.getAttribute('aria-required'),
          isVisible: computedStyle.display !== 'none' &&
                     computedStyle.visibility !== 'hidden' &&
                     rect.width > 0 && rect.height > 0,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });

      // Find all buttons
      document.querySelectorAll('button, [type="submit"], [role="button"]').forEach(btn => {
        const rect = btn.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(btn);
        form.buttons.push({
          tagName: btn.tagName.toLowerCase(),
          id: btn.id || null,
          className: btn.className,
          type: btn.type || null,
          textContent: btn.textContent?.trim(),
          innerHTML: btn.innerHTML.substring(0, 200),
          role: btn.getAttribute('role'),
          ariaLabel: btn.getAttribute('aria-label'),
          disabled: btn.disabled,
          isVisible: computedStyle.display !== 'none' &&
                     computedStyle.visibility !== 'hidden' &&
                     rect.width > 0 && rect.height > 0,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          onclick: btn.onclick ? btn.onclick.toString().substring(0, 200) : null
        });
      });

      // Find all labels
      document.querySelectorAll('label').forEach(label => {
        const rect = label.getBoundingClientRect();
        form.labels.push({
          tagName: 'label',
          id: label.id || null,
          className: label.className,
          htmlFor: label.htmlFor || null,
          textContent: label.textContent?.trim(),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });

      return form;
    });

    analysisResult.loginForm = loginForm;
    console.log(`Found ${loginForm.inputs.length} inputs, ${loginForm.buttons.length} buttons`);

    // Get page info
    console.log('Getting page info...');
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        documentElement: {
          tagName: document.documentElement.tagName,
          className: document.documentElement.className,
          lang: document.documentElement.lang
        },
        body: {
          tagName: document.body.tagName,
          className: document.body.className,
          innerHTML: document.body.innerHTML.substring(0, 2000)
        },
        scripts: Array.from(document.scripts).map(s => ({
          src: s.src || null,
          type: s.type || null
        })),
        stylesheets: Array.from(document.styleSheets).map(s => ({
          href: s.href || null
        }))
      };
    });

    analysisResult.pageInfo = pageInfo;

    // Get accessibility tree using CDP
    console.log('Getting accessibility tree...');
    try {
      const client = await context.newCDPSession(page);
      await client.send('Accessibility.enable');
      const { nodes } = await client.send('Accessibility.getFullAXTree');

      // Filter and simplify the tree
      analysisResult.accessibilityTree = {
        totalNodes: nodes.length,
        interactiveNodes: nodes.filter(node =>
          node.role?.value &&
          ['button', 'link', 'textbox', 'tab', 'tabpanel', 'checkbox', 'radio'].includes(node.role.value)
        ).map(node => ({
          nodeId: node.nodeId,
          role: node.role?.value,
          name: node.name?.value || null,
          value: node.value?.value || null,
          description: node.description?.value || null,
          properties: node.properties?.map(p => ({
            name: p.name,
            value: p.value?.value
          })) || [],
          childIds: node.childIds || []
        }))
      };

      await client.detach();
    } catch (error) {
      console.error('Error getting accessibility tree:', error.message);
      analysisResult.accessibilityTree = { error: error.message };
    }

    // Take screenshot
    console.log('Taking screenshot...');
    await page.screenshot({
      path: '/mnt/d/00.Projects/02.보탬e/botame-admin/login-page-screenshot.png',
      fullPage: true
    });

    // Save results
    const outputPath = '/mnt/d/00.Projects/02.보탬e/botame-admin/login-page-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify(analysisResult, null, 2));
    console.log(`Analysis saved to: ${outputPath}`);

    // Create a summary
    const summary = {
      totalInteractiveElements: analysisResult.interactiveElements.length,
      visibleInteractiveElements: analysisResult.interactiveElements.filter(e => e.isVisible).length,
      tabs: analysisResult.tabStructure.tabs.length,
      forms: analysisResult.loginForm.forms.length,
      inputs: analysisResult.loginForm.inputs.length,
      visibleInputs: analysisResult.loginForm.inputs.filter(i => i.isVisible).length,
      buttons: analysisResult.loginForm.buttons.length,
      visibleButtons: analysisResult.loginForm.buttons.filter(b => b.isVisible).length,
      accessibilityNodes: analysisResult.accessibilityTree?.totalNodes || 0,
      interactiveAccessibilityNodes: analysisResult.accessibilityTree?.interactiveNodes?.length || 0
    };

    console.log('\n=== Analysis Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('========================\n');

    // Save summary
    fs.writeFileSync(
      '/mnt/d/00.Projects/02.보탬e/botame-admin/login-page-summary.json',
      JSON.stringify(summary, null, 2)
    );

  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
})();
