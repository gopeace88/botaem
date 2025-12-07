const fs = require('fs');

// Load the analysis data
const analysisData = JSON.parse(fs.readFileSync('/mnt/d/00.Projects/02.보탬e/botame-admin/login-page-analysis.json', 'utf8'));

// Create structured report
const report = {
  metadata: {
    url: analysisData.url,
    timestamp: analysisData.timestamp,
    viewport: analysisData.viewport
  },

  // 1. Page Interactive Elements Summary
  interactiveElementsSummary: {
    total: analysisData.interactiveElements.length,
    visible: analysisData.interactiveElements.filter(e => e.isVisible).length,
    byType: {}
  },

  // 2. Login-related elements (forms, inputs, buttons)
  loginElements: {
    forms: analysisData.loginForm.forms,
    inputs: analysisData.loginForm.inputs.filter(i => i.isVisible),
    buttons: analysisData.loginForm.buttons.filter(b => b.isVisible),
    labels: analysisData.loginForm.labels
  },

  // 3. Tab structure
  tabStructure: {
    containers: analysisData.tabStructure.containers,
    tabs: analysisData.tabStructure.tabs,
    panels: analysisData.tabStructure.panels
  },

  // 4. All clickable elements (buttons and links)
  clickableElements: {
    buttons: [],
    links: []
  },

  // 5. Accessibility information
  accessibility: {
    totalNodes: analysisData.accessibilityTree?.totalNodes || 0,
    interactiveNodes: analysisData.accessibilityTree?.interactiveNodes || []
  }
};

// Group interactive elements by type
analysisData.interactiveElements.forEach(el => {
  const type = el.tagName;
  if (!report.interactiveElementsSummary.byType[type]) {
    report.interactiveElementsSummary.byType[type] = { total: 0, visible: 0 };
  }
  report.interactiveElementsSummary.byType[type].total++;
  if (el.isVisible) {
    report.interactiveElementsSummary.byType[type].visible++;
  }

  // Categorize clickable elements
  if (type === 'button' && el.isVisible) {
    report.clickableElements.buttons.push({
      className: el.className,
      textContent: el.textContent,
      type: el.type,
      xpath: el.xpath,
      boundingBox: el.boundingBox,
      onclick: el.onclick
    });
  } else if (type === 'a' && el.isVisible) {
    report.clickableElements.links.push({
      className: el.className,
      textContent: el.textContent,
      href: el.href,
      xpath: el.xpath,
      boundingBox: el.boundingBox
    });
  }
});

// Find login-specific elements
const loginRelatedInputs = report.loginElements.inputs.filter(input => {
  const id = (input.id || '').toLowerCase();
  const name = (input.name || '').toLowerCase();
  const placeholder = (input.placeholder || '').toLowerCase();

  return id.includes('id') || id.includes('login') || id.includes('user') || id.includes('pass') ||
         name.includes('id') || name.includes('login') || name.includes('user') || name.includes('pass') ||
         placeholder.includes('아이디') || placeholder.includes('비밀번호') || placeholder.includes('password');
});

const loginRelatedButtons = report.clickableElements.buttons.filter(btn => {
  const text = (btn.textContent || '').toLowerCase();
  const className = (btn.className || '').toLowerCase();

  return text.includes('로그인') || text.includes('login') ||
         className.includes('login') || className.includes('sign');
});

// Detailed login analysis
report.detailedLoginAnalysis = {
  loginInputs: loginRelatedInputs,
  loginButtons: loginRelatedButtons,

  // Look for tab elements related to login
  loginTabs: report.tabStructure.tabs.filter(tab => {
    const text = (tab.textContent || '').toLowerCase();
    return text.includes('아이디') || text.includes('로그인') || text.includes('id') ||
           text.includes('인증서') || text.includes('간편');
  })
};

// Create a simplified visualization-friendly structure
report.visualizationData = {
  // All visible interactive elements with coordinates
  interactiveElements: analysisData.interactiveElements
    .filter(e => e.isVisible && e.boundingBox.width > 0 && e.boundingBox.height > 0)
    .map(e => ({
      type: e.tagName,
      text: e.textContent?.substring(0, 50),
      role: e.role,
      x: e.boundingBox.x,
      y: e.boundingBox.y,
      width: e.boundingBox.width,
      height: e.boundingBox.height,
      xpath: e.xpath,
      className: e.className,
      id: e.id
    }))
};

// Save structured report
fs.writeFileSync(
  '/mnt/d/00.Projects/02.보탬e/botame-admin/login-page-structured-report.json',
  JSON.stringify(report, null, 2)
);

// Create a human-readable summary
const summary = `
# 보탬e 로그인 페이지 DOM 구조 분석 결과

## 기본 정보
- URL: ${report.metadata.url}
- 분석 시각: ${report.metadata.timestamp}
- Viewport: ${report.metadata.viewport.width}x${report.metadata.viewport.height}

## 1. 인터랙티브 요소 통계
- 전체 인터랙티브 요소: ${report.interactiveElementsSummary.total}개
- 화면에 표시된 요소: ${report.interactiveElementsSummary.visible}개

### 요소 타입별 분류:
${Object.entries(report.interactiveElementsSummary.byType)
  .map(([type, counts]) => `  - ${type}: ${counts.visible}/${counts.total}개 (visible/total)`)
  .join('\n')}

## 2. 로그인 폼 구조
- 폼 개수: ${report.loginElements.forms.length}개
- 입력 필드: ${report.loginElements.inputs.length}개
- 버튼: ${report.loginElements.buttons.length}개
- 레이블: ${report.loginElements.labels.length}개

### 로그인 관련 입력 필드:
${loginRelatedInputs.map((input, idx) => `
  ${idx + 1}. Input Field:
     - ID: ${input.id || 'N/A'}
     - Name: ${input.name || 'N/A'}
     - Type: ${input.type}
     - Placeholder: ${input.placeholder || 'N/A'}
     - Position: (${Math.round(input.boundingBox.x)}, ${Math.round(input.boundingBox.y)})
     - Size: ${Math.round(input.boundingBox.width)}x${Math.round(input.boundingBox.height)}
     - XPath: ${input.xpath || 'N/A'}
`).join('')}

### 로그인 관련 버튼:
${loginRelatedButtons.map((btn, idx) => `
  ${idx + 1}. Button:
     - Text: ${btn.textContent}
     - Class: ${btn.className || 'N/A'}
     - Type: ${btn.type || 'N/A'}
     - Position: (${Math.round(btn.boundingBox.x)}, ${Math.round(btn.boundingBox.y)})
     - Size: ${Math.round(btn.boundingBox.width)}x${Math.round(btn.boundingBox.height)}
     - XPath: ${btn.xpath || 'N/A'}
     - OnClick: ${btn.onclick ? btn.onclick.substring(0, 100) : 'N/A'}
`).join('')}

## 3. 탭 구조
- 탭 컨테이너: ${report.tabStructure.containers.length}개
- 탭 아이템: ${report.tabStructure.tabs.length}개
- 탭 패널: ${report.tabStructure.panels.length}개

### 로그인 관련 탭:
${report.detailedLoginAnalysis.loginTabs.map((tab, idx) => `
  ${idx + 1}. Tab:
     - Text: ${tab.textContent}
     - Class: ${tab.className || 'N/A'}
     - ID: ${tab.id || 'N/A'}
     - Role: ${tab.role || 'N/A'}
     - Active: ${tab.isActive}
     - aria-selected: ${tab.ariaSelected || 'N/A'}
     - aria-controls: ${tab.ariaControls || 'N/A'}
     - Position: (${Math.round(tab.boundingBox.x)}, ${Math.round(tab.boundingBox.y)})
     - Size: ${Math.round(tab.boundingBox.width)}x${Math.round(tab.boundingBox.height)}
`).join('')}

### 모든 탭 아이템:
${report.tabStructure.tabs.map((tab, idx) => `
  ${idx + 1}. Tab:
     - Text: ${tab.textContent}
     - Class: ${tab.className || 'N/A'}
     - Active: ${tab.isActive}
     - aria-selected: ${tab.ariaSelected || 'N/A'}
`).join('')}

## 4. Accessibility Tree
- 전체 노드: ${report.accessibility.totalNodes}개
- 인터랙티브 노드: ${report.accessibility.interactiveNodes.length}개

### 인터랙티브 Accessibility 노드 (처음 20개):
${report.accessibility.interactiveNodes.slice(0, 20).map((node, idx) => `
  ${idx + 1}. Node:
     - Role: ${node.role}
     - Name: ${node.name || 'N/A'}
     - Value: ${node.value || 'N/A'}
     - Description: ${node.description || 'N/A'}
`).join('')}

## 5. 클릭 가능한 요소 요약
- 버튼: ${report.clickableElements.buttons.length}개
- 링크: ${report.clickableElements.links.length}개

### 주요 버튼 (처음 10개):
${report.clickableElements.buttons.slice(0, 10).map((btn, idx) => `
  ${idx + 1}. ${btn.textContent} - Class: ${btn.className || 'N/A'}
`).join('')}

## 6. 시각화 데이터
- 화면에 표시된 인터랙티브 요소: ${report.visualizationData.interactiveElements.length}개

---
보고서 생성 완료
`;

fs.writeFileSync(
  '/mnt/d/00.Projects/02.보탬e/botame-admin/login-page-summary-report.md',
  summary
);

console.log('✓ Structured report created: login-page-structured-report.json');
console.log('✓ Summary report created: login-page-summary-report.md');
console.log(`\n총 ${report.interactiveElementsSummary.visible}개의 표시된 인터랙티브 요소 분석 완료`);
console.log(`로그인 관련 입력 필드: ${loginRelatedInputs.length}개`);
console.log(`로그인 관련 버튼: ${loginRelatedButtons.length}개`);
console.log(`탭 구조: ${report.tabStructure.tabs.length}개의 탭`);
