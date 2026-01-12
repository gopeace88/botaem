
/**
 * Verification Script for SmartSelectorGenerator
 * 
 * This script manually verifies the new heuristic logic:
 * 1. Parent Chaining (extracting #parent > button)
 * 2. Stable Class Detection (ignoring tailwind classes)
 * 3. Dynamic ID Filtering
 */

import { SmartSelectorGenerator } from './electron/core/smart-selector';
import { ElementSnapshot } from './shared/types';

// Mock Element Snapshot
const mockSnapshot: ElementSnapshot = {
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

const mockDynamicIdSnapshot: ElementSnapshot = {
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

async function runVerification() {
    console.log('=== Starting SmartSelector Verification ===');
    const generator = new SmartSelectorGenerator();

    // Test 1: Parent Chaining & Class Filtering
    console.log('\n[Test 1] Generating selectors for Button inside #login-form...');
    const result1 = generator.generateFromSnapshot(mockSnapshot);

    console.log('Primary Selector:', result1.primary.value);
    console.log('Confidence:', result1.primary.confidence);

    console.log('Fallback Selectors:');
    result1.fallbacks.forEach(f => {
        console.log(` - [${f.strategy}] "${f.value}" (Confidence: ${f.confidence})`);
    });

    // Verification Logic for Test 1
    const hasParentChain = result1.fallbacks.some(f => f.value === '#login-form button');
    const hasStableClass = result1.fallbacks.some(f => f.value === 'button.btn-primary');
    const ignoresTailwind = !result1.fallbacks.some(f => f.value.includes('w-full'));

    if (hasParentChain) console.log('✅ PASS: Parent Chaining (#login-form button) found.');
    else console.log('❌ FAIL: Parent Chaining not found.');

    if (hasStableClass) console.log('✅ PASS: Stable Class (btn-primary) extracted.');
    else console.log('❌ FAIL: Stable Class extraction failing.');

    if (ignoresTailwind) console.log('✅ PASS: Tailwind classes (w-full, p-4) ignored.');
    else console.log('❌ FAIL: Utility classes were NOT ignored.');


    // Test 2: Dynamic ID Filtering
    console.log('\n[Test 2] Testing Dynamic ID filtering (id="react-1234-abcd")...');
    const result2 = generator.generateFromSnapshot(mockDynamicIdSnapshot);

    const usedId = result2.fallbacks.some(f => f.value === '#react-1234-abcd');
    if (!usedId) console.log('✅ PASS: Dynamic ID was correctly ignored/penalized.');
    else console.log('❌ FAIL: Dynamic ID was used as a strategy.');

    console.log('\n=== Verification Complete ===');
}

runVerification().catch(console.error);
