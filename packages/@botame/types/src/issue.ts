import { ElementInfo } from "./recording";

export interface PlaybookIssue {
    id: string; // UUID
    title: string; // "Button click failed at Step 5"
    description: string; // "Element not found after 30s timeout..."
    status: 'open' | 'analyzing' | 'resolved' | 'ignored';

    // Context (The "Git Commit" snapshot)
    elementInfo: ElementInfo; // Target that was lost (subset of snapshot)
    domSnapshot: string; // HTML around the failure point
    screenshot?: string; // Base64 (optional)

    // Metadata
    playbookId: string;
    stepIndex: number;
    errorType: 'NotFound' | 'Timeout' | 'Intersecting' | 'Other';
    timestamp: number;
    environment: {
        os: string;
        browser: string;
        version: string;
    };
}

