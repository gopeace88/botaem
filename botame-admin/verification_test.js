"use strict";
/**
 * Verification Script for SmartSelectorGenerator
 *
 * This script manually verifies the new heuristic logic:
 * 1. Parent Chaining (extracting #parent > button)
 * 2. Stable Class Detection (ignoring tailwind classes)
 * 3. Dynamic ID Filtering
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var smart_selector_1 = require("./electron/core/smart-selector");
// Mock Element Snapshot
var mockSnapshot = {
    nodeId: 1,
    backendNodeId: 1,
    tagName: 'BUTTON',
    attributes: {
        // A mix of stable and utility classes
        class: 'btn-primary w-full p-4 flex items-center hover:bg-blue-500',
        // No unique ID on the element itself, but...
    },
    textContent: 'Submit',
    // cssPath shows it's inside a stable parent
    cssPath: 'body > div#login-form > div.content > button',
    xpath: '//button',
    boundingBox: { x: 0, y: 0, width: 100, height: 50 },
    isVisible: true,
    isInViewport: true
};
var mockDynamicIdSnapshot = {
    nodeId: 2,
    backendNodeId: 2,
    tagName: 'DIV',
    attributes: {
        // Dynamic ID that should be ignored
        id: 'react-1234-abcd',
        class: 'content-box'
    },
    textContent: 'Dynamic Content',
    cssPath: 'body > div#app > div#react-1234-abcd',
    xpath: '//div',
    boundingBox: { x: 0, y: 0, width: 100, height: 50 },
    isVisible: true,
    isInViewport: true
};
function runVerification() {
    return __awaiter(this, void 0, void 0, function () {
        var generator, result1, hasParentChain, hasStableClass, ignoresTailwind, result2, usedId;
        return __generator(this, function (_a) {
            console.log('=== Starting SmartSelector Verification ===');
            generator = new smart_selector_1.SmartSelectorGenerator();
            // Test 1: Parent Chaining & Class Filtering
            console.log('\n[Test 1] Generating selectors for Button inside #login-form...');
            result1 = generator.generateFromSnapshot(mockSnapshot);
            console.log('Primary Selector:', result1.primary.value);
            console.log('Confidence:', result1.primary.confidence);
            console.log('Fallback Selectors:');
            result1.fallbacks.forEach(function (f) {
                console.log(" - [".concat(f.strategy, "] \"").concat(f.value, "\" (Confidence: ").concat(f.confidence, ")"));
            });
            hasParentChain = result1.fallbacks.some(function (f) { return f.value === '#login-form button'; });
            hasStableClass = result1.fallbacks.some(function (f) { return f.value === 'button.btn-primary'; });
            ignoresTailwind = !result1.fallbacks.some(function (f) { return f.value.includes('w-full'); });
            if (hasParentChain)
                console.log('✅ PASS: Parent Chaining (#login-form button) found.');
            else
                console.log('❌ FAIL: Parent Chaining not found.');
            if (hasStableClass)
                console.log('✅ PASS: Stable Class (btn-primary) extracted.');
            else
                console.log('❌ FAIL: Stable Class extraction failing.');
            if (ignoresTailwind)
                console.log('✅ PASS: Tailwind classes (w-full, p-4) ignored.');
            else
                console.log('❌ FAIL: Utility classes were NOT ignored.');
            // Test 2: Dynamic ID Filtering
            console.log('\n[Test 2] Testing Dynamic ID filtering (id="react-1234-abcd")...');
            result2 = generator.generateFromSnapshot(mockDynamicIdSnapshot);
            usedId = result2.fallbacks.some(function (f) { return f.value === '#react-1234-abcd'; });
            if (!usedId)
                console.log('✅ PASS: Dynamic ID was correctly ignored/penalized.');
            else
                console.log('❌ FAIL: Dynamic ID was used as a strategy.');
            console.log('\n=== Verification Complete ===');
            return [2 /*return*/];
        });
    });
}
runVerification().catch(console.error);
