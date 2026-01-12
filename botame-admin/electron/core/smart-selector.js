"use strict";
/**
 * Smart Selector Generator - 다중 선택자 체인 자동 생성
 *
 * 보탬e 특화: 한국 웹사이트에서 흔한 동적 ID, iframe 처리
 * v2.1: Phase 1 Smart Algorithms (Parent Chaining, Stable Class Detection)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSelectorGenerator = void 0;
var crypto = __importStar(require("crypto"));
var SmartSelectorGenerator = /** @class */ (function () {
    function SmartSelectorGenerator() {
    }
    /**
     * 요소 스냅샷에서 스마트 셀렉터 생성
     */
    SmartSelectorGenerator.prototype.generateFromSnapshot = function (element) {
        var selectors = this.generateAllSelectors(element);
        // 신뢰도 순으로 정렬
        selectors.sort(function (a, b) { return b.confidence - a.confidence; });
        var primary = selectors[0], fallbacks = selectors.slice(1);
        return {
            primary: primary || { strategy: 'css', value: element.tagName.toLowerCase(), confidence: 10 },
            fallbacks: fallbacks,
            coordinates: element.boundingBox,
            elementHash: this.generateElementHash(element),
            snapshot: element,
        };
    };
    /**
     * 모든 가능한 선택자 생성
     * INPUT/TEXTAREA/SELECT 요소에는 label/text/role 선택자를 생성하지 않음
     */
    SmartSelectorGenerator.prototype.generateAllSelectors = function (element) {
        var selectors = [];
        var attrs = element.attributes;
        var isInputElement = this.isInputElement(element.tagName);
        // 1. data-testid (가장 안정적)
        if (attrs['data-testid']) {
            selectors.push({
                strategy: 'testId',
                value: attrs['data-testid'],
                confidence: 95,
            });
        }
        // 2. name 속성 (폼 요소) - INPUT에서 가장 중요
        if (attrs['name'] && this.isFormElement(element.tagName)) {
            selectors.push({
                strategy: 'css',
                value: "".concat(element.tagName.toLowerCase(), "[name=\"").concat(attrs['name'], "\"]"),
                confidence: isInputElement ? 95 : 80,
            });
        }
        // 3. 타입 속성 (input) - password, email 등 고유한 타입
        if (element.tagName.toUpperCase() === 'INPUT' && attrs['type']) {
            var type = attrs['type'];
            var uniqueTypes = ['password', 'email', 'tel', 'search', 'url', 'number', 'date', 'file'];
            var confidence = uniqueTypes.includes(type) ? 90 : 50;
            selectors.push({
                strategy: 'css',
                value: "input[type=\"".concat(type, "\"]"),
                confidence: confidence,
            });
        }
        // 3.5. aria-label (INPUT 요소에서 매우 유용) - CSS 선택자로 생성
        if (attrs['aria-label'] && isInputElement) {
            var tagName = element.tagName.toLowerCase();
            selectors.push({
                strategy: 'css',
                value: "".concat(tagName, "[aria-label=\"").concat(attrs['aria-label'], "\"]"),
                confidence: 88, // name(95) < aria-label < password type(90)
            });
        }
        // 4. ID (동적 ID 감지하여 신뢰도 조정)
        if (attrs['id']) {
            var isStable = this.isStableId(attrs['id']);
            // 매우 불안정한 ID는 제외 (숫자만 있거나 너무 긴 랜덤 문자열)
            if (isStable) {
                selectors.push({
                    strategy: 'css',
                    value: "#".concat(attrs['id']),
                    confidence: 85,
                });
            }
        }
        // 5. placeholder (입력 필드)
        if (attrs['placeholder'] && isInputElement) {
            selectors.push({
                strategy: 'placeholder',
                value: attrs['placeholder'],
                confidence: 80,
            });
        }
        // === INPUT 요소에는 아래 선택자들을 생성하지 않음 ===
        if (!isInputElement) {
            // 6. ARIA 레이블 (버튼, 링크에만)
            if (attrs['aria-label']) {
                selectors.push({
                    strategy: 'label',
                    value: attrs['aria-label'],
                    confidence: 75,
                });
            }
            // 7. Role + 이름 조합 (버튼, 링크에만)
            if (element.role && element.name) {
                selectors.push({
                    strategy: 'role',
                    value: "".concat(element.role, "[name=\"").concat(element.name, "\"]"),
                    confidence: 70,
                });
            }
            // 8. 텍스트 내용 (버튼, 링크에만)
            if (element.textContent && this.isTextBasedElement(element.tagName)) {
                var text = element.textContent.trim().slice(0, 50);
                if (text && text.length > 1) {
                    // Playwright :has-text 사용
                    selectors.push({
                        strategy: 'text',
                        value: "text=".concat(text),
                        confidence: 65,
                    });
                }
            }
        }
        // 9. CSS 클래스 조합
        if (attrs['class']) {
            var stableClasses = this.extractStableClasses(attrs['class']);
            if (stableClasses.length > 0) {
                var cssSelector = "".concat(element.tagName.toLowerCase(), ".").concat(stableClasses.join('.'));
                selectors.push({
                    strategy: 'css',
                    value: cssSelector,
                    confidence: 45,
                });
            }
        }
        // 10. Parent Chain (CSS Path 분석) - NEW in Phase 1
        var parentSelectors = this.generateParentChainSelectors(element);
        selectors.push.apply(selectors, parentSelectors);
        // 11. XPath (최후의 수단)
        if (element.xpath) {
            selectors.push({
                strategy: 'xpath',
                value: element.xpath,
                confidence: 30,
            });
        }
        // 12. 전체 CSS 경로 (가장 낮은 신뢰도)
        if (element.cssPath) {
            selectors.push({
                strategy: 'css',
                value: element.cssPath,
                confidence: 20,
            });
        }
        return selectors;
    };
    /**
     * 부모 체인 선택자 생성 (cssPath 분석)
     * 예: "body > div#app > div.content > button" -> "#app button"
     */
    SmartSelectorGenerator.prototype.generateParentChainSelectors = function (element) {
        var selectors = [];
        if (!element.cssPath)
            return selectors;
        var parts = element.cssPath.split(' > ');
        if (parts.length < 2)
            return selectors;
        // 현재 요소 자신을 제외
        var mySelector = parts.pop();
        // 부모들 중에서 ID가 있는 가장 가까운 부모 찾기
        for (var i = parts.length - 1; i >= 0; i--) {
            var part = parts[i];
            if (part.includes('#')) {
                var idMatch = part.match(/#([^.]+)/);
                if (idMatch && this.isStableId(idMatch[1])) {
                    // 안정적인 ID를 가진 부모 발견
                    var parentId = idMatch[1];
                    // 1. Direct descendant (ID > Tag)
                    selectors.push({
                        strategy: 'css',
                        value: "#".concat(parentId, " ").concat(mySelector),
                        confidence: 60, // 클래스 기반(45)보다 높고 텍스트(65)보다 낮음
                    });
                    // 2. 만약 현재 요소가 클래스가 있다면 더 강력한 조합
                    if (element.attributes['class']) {
                        var stableClasses = this.extractStableClasses(element.attributes['class']);
                        if (stableClasses.length > 0) {
                            selectors.push({
                                strategy: 'css',
                                value: "#".concat(parentId, " .").concat(stableClasses.join('.')),
                                confidence: 62,
                            });
                        }
                    }
                    // 가장 가까운 부모만 사용하고 종료 (너무 상위 부모는 의미가 약함)
                    break;
                }
            }
        }
        return selectors;
    };
    /**
     * INPUT 요소인지 확인
     */
    SmartSelectorGenerator.prototype.isInputElement = function (tagName) {
        return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName.toUpperCase());
    };
    /**
     * 안정적인 ID인지 확인 (동적 ID 감지)
     * 개선: 더 많은 동적 패턴 필터링
     */
    SmartSelectorGenerator.prototype.isStableId = function (id) {
        if (!id)
            return false;
        // 동적 ID 패턴 감지
        var dynamicPatterns = [
            /^[a-f0-9]{8}-[a-f0-9]{4}/i, // UUID
            /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i, // UUID anywhere
            /^\d+$/, // 숫자로만 구성된 ID
            /^\d{10,}/, // 타임스탬프
            /_\d+$/, // 숫자 접미사 (_123)
            /-\d+$/, // 숫자 접미사 (-123)
            /^react-/i, // React 생성 ID
            /^ember/i, // Ember 생성 ID
            /^ng-/i, // Angular 생성 ID
            /^:r[0-9a-z]+:/i, // React 18+ ID
            /^pt-/i, // 동적 pt- 접두사
            /^uuid-/i, // uuid 접두사
            /^ext-gen/i, // ExtJS
            /^yui-gen/i, // YUI
            /^closure-lm/i, // Google Closure
            /\//, // 슬래시 포함 (CSS 선택자에 문제)
            /\./, // 점 포함 (CSS 선택자에 문제)
        ];
        return !dynamicPatterns.some(function (pattern) { return pattern.test(id); });
    };
    /**
     * 안정적인 클래스 추출 (동적 클래스 및 유틸리티 클래스 제외)
     * 개선: Tailwind 등 유틸리티 클래스 필터링 강화
     */
    SmartSelectorGenerator.prototype.extractStableClasses = function (classString) {
        var classes = classString.split(/\s+/).filter(function (c) { return c.trim(); });
        // 동적 및 유틸리티 클래스 패턴
        var ignoredPatterns = [
            // Dynamic Frameworks
            /^css-[a-z0-9]+$/i, // CSS-in-JS
            /^sc-[a-z]+$/i, // Styled Components
            /^_[a-z0-9]{5,}$/i, // CSS Modules
            /^emotion-/i, // Emotion
            /--[a-z0-9]{6,}$/i, // Tailwind variants specific
            // Tailwind / Bootstrap Utility Classes (Layout/Spacing/Sizing)
            /^(p|m)(t|b|l|r|x|y)?-\d+/, // padding/margin (p-4, mt-2)
            /^w-\d+|w-full|w-screen/, // width
            /^h-\d+|h-full|h-screen/, // height
            /^flex/, /^grid/, // layout
            /^items-/, /^justify-/, // alignment
            /^text-(xs|sm|base|lg|xl)/, // text size
            /^text-(left|center|right)/, // text align
            /^bg-(red|blue|green|gray|white|black)/, // colors
            /^absolute|relative|fixed/, // positioning
            /^hidden|block|inline/, // display
            /^border/, /^rounded/, // border
            /^hover:/, /^focus:/, // states
            /^d-/, // Bootstrap (d-flex)
            /^col-/, /^row-/, // Grid
        ];
        // 의미있는 비즈니스 클래스만 필터링 (e.g., 'btn-login', 'nav-item', 'header-logo')
        // 너무 짧거나(2글자 이하) 너무 긴(40자 이상) 클래스도 제외
        var stableClasses = classes
            .filter(function (c) { return !ignoredPatterns.some(function (p) { return p.test(c); }); })
            .filter(function (c) { return c.length > 2 && c.length < 40; })
            .slice(0, 2); // 최대 2개까지만 사용 (과도한 구체화 방지)
        return stableClasses;
    };
    /**
     * 폼 요소인지 확인
     */
    SmartSelectorGenerator.prototype.isFormElement = function (tagName) {
        return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName.toUpperCase());
    };
    /**
     * 텍스트 기반 요소인지 확인
     */
    SmartSelectorGenerator.prototype.isTextBasedElement = function (tagName) {
        return ['BUTTON', 'A', 'SPAN', 'DIV', 'LABEL', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
            .includes(tagName.toUpperCase());
    };
    /**
     * 요소 해시 생성 (변경 감지용)
     */
    SmartSelectorGenerator.prototype.generateElementHash = function (element) {
        var _a;
        var hashSource = [
            element.tagName,
            element.attributes['id'] || '',
            element.attributes['class'] || '',
            element.attributes['name'] || '',
            ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.slice(0, 20)) || '',
            element.role || '',
        ].join('|');
        return crypto.createHash('md5').update(hashSource).digest('hex').slice(0, 8);
    };
    /**
     * 두 스마트 셀렉터의 유사도 계산
     */
    SmartSelectorGenerator.prototype.calculateSimilarity = function (a, b) {
        var score = 0;
        // 해시 일치
        if (a.elementHash === b.elementHash)
            score += 50;
        // 좌표 근접성 (100px 이내)
        var dx = Math.abs(a.coordinates.x - b.coordinates.x);
        var dy = Math.abs(a.coordinates.y - b.coordinates.y);
        if (dx < 100 && dy < 100) {
            score += 30 * (1 - (dx + dy) / 200);
        }
        // 선택자 일치
        if (a.primary.value === b.primary.value)
            score += 20;
        return Math.min(100, score);
    };
    return SmartSelectorGenerator;
}());
exports.SmartSelectorGenerator = SmartSelectorGenerator;
