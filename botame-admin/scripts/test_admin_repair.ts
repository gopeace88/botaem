import { getAISelectorService } from '../electron/services/ai-selector.service';
import { PlaybookIssue } from '../../packages/@botame/types/src/issue';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env for API Key
dotenv.config();

async function runRepair() {
    console.log('🔄 Starting Admin Repair Simulation...');

    // 1. Load the mock packet
    const packetPath = path.resolve(__dirname, 'mock_failure_packet.json');
    if (!fs.existsSync(packetPath)) {
        console.error('❌ Mock packet not found. Run simulate_bot_failure.ts first.');
        return;
    }

    const issue: PlaybookIssue = JSON.parse(fs.readFileSync(packetPath, 'utf-8'));
    console.log(`📄 Loaded Issue: ${issue.title}`);

    // 2. Initialize Service
    const aiService = getAISelectorService();

    // Check API Key
    if (!aiService.isEnabled()) {
        console.warn('⚠️ AI Service not enabled (Check ANTHROPIC_API_KEY). Skipping actual call.');
        // Mocking response for test if no key
        return;
    }

    // 3. Attempt Repair
    console.log('🤖 Asking Claude for repair...');
    try {
        const result = await aiService.repairIssue(issue);

        if (result) {
            console.log('✅ Repair Successful!');
            console.log('--- Proposed Selectors ---');
            result.selectors.forEach((s, i) => {
                console.log(`[${i + 1}] ${s.strategy}: "${s.value}" (Confidence: ${s.confidence})`);
            });
            console.log('--------------------------');
            console.log('Reasoning:', result.reasoning);
        } else {
            console.log('❌ Cloud failed to generate selectors.');
        }
    } catch (error) {
        console.error('❌ Error during repair:', error);
    }
}

runRepair();
