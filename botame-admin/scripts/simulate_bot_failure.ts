import { PlaybookIssue } from '../../packages/@botame/types/src/issue';
import { ElementInfo } from '../../packages/@botame/types/src/recording';
import * as fs from 'fs';
import * as path from 'path';

// Mock Element that was lost
const lostElement: ElementInfo = {
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
const issue: PlaybookIssue = {
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
