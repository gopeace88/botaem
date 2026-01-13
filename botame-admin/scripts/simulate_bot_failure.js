"use strict";
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Mock Element that was lost
const lostElement = {
    tagName: 'BUTTON',
    text: '교부관리',
    className: 'btn btn-primary',
    role: 'button'
};
// Mock DOM Snapshot (Context)
const domSnapshot = `
<div class="gnb-menu">
    <ul>
        <li><a href="#">홈</a></li>
        <li><a href="#">사업관리</a></li>
        <li>
            <!-- The button structure changed slightly, ID is gone -->
            <button class="btn btn-primary nav-item" aria-label="교부관리">
                <span>교부관리</span>
            </button>
        </li>
    </ul>
</div>
`;
// Create Issue Packet
const issue = {
    id: 'issue-' + Date.now(),
    title: 'Button click failed: "교부관리"',
    description: 'Element not found after 10s timeout. Primary selector "#gnb-gyobu" failed.',
    status: 'open',
    elementInfo: lostElement,
    domSnapshot: domSnapshot,
    playbookId: 'pb-123',
    stepIndex: 5,
    errorType: 'NotFound',
    timestamp: Date.now(),
    environment: {
        os: 'windows',
        browser: 'chrome',
        version: '120.0'
    }
};
// Save to file (Simulating Upload to Supabase)
const outputPath = path.resolve(__dirname, 'mock_failure_packet.json');
fs.writeFileSync(outputPath, JSON.stringify(issue, null, 2));
console.log('✅ Mock failure packet created at:', outputPath);
