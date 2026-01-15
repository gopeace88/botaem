/**
 * Local Playbook Validation (without Supabase)
 * Tests validation logic with mock data
 */

import { Playbook, PlaybookStep } from "@botame/types";
import * as fs from "fs/promises";

// Mock playbook data (simulating Supabase structure)
const mockPlaybooks: any[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    playbook_id: "test-login-1",
    name: "로그인 테스트",
    description: "기본 로그인 플레이북",
    category: "회원관리",
    difficulty: "쉬움",
    estimated_time: "5분",
    keywords: ["로그인", "인증"],
    version: "1.0.0",
    author: "admin",
    status: "active",
    is_published: true,
    steps: [
      {
        id: "1",
        action: "click",
        selector: "#login-button",
        message: "로그인 버튼 클릭",
      },
      {
        id: "2",
        action: "type",
        selector: "input[name='username']",
        value: "{{user_id}}",
        message: "아이디 입력",
      },
    ],
    metadata: {
      startUrl: "https://www.losims.go.kr/lss.do",
    },
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    playbook_id: "test-form-2",
    name: "폼 작성 테스트 (구버전)",
    description: "smartSelector 없는 구버전",
    category: "신청",
    difficulty: "보통",
    status: "draft",
    steps: [
      {
        id: "1",
        action: "click",
        selector: ".submit-btn",
        message: "제출 버튼",
      },
    ],
    metadata: {},
  },
];

interface ValidationResult {
  valid: boolean;
  playbookId: string;
  name: string;
  errors: string[];
  warnings: string[];
  needsMigration: boolean;
}

class LocalPlaybookValidator {
  private results: ValidationResult[] = [];

  async validateAll(): Promise<ValidationResult[]> {
    console.log("📋 Validating mock playbooks...\n");

    for (const playbook of mockPlaybooks) {
      const result = this.validatePlaybook(playbook);
      this.results.push(result);
    }

    this.printReport();
    return this.results;
  }

  private validatePlaybook(playbook: any): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      playbookId: playbook.playbook_id,
      name: playbook.name,
      errors: [],
      warnings: [],
      needsMigration: false,
    };

    console.log(`🔍 Validating: ${playbook.name} (${playbook.playbook_id})`);

    // 1. Check metadata
    if (!playbook.metadata) {
      result.errors.push("Missing metadata field");
      result.valid = false;
    } else {
      // Check aliases
      if (!playbook.metadata.aliases) {
        result.warnings.push("Missing aliases field in metadata");
        result.needsMigration = true;
      }

      // Check startUrl
      if (!playbook.metadata.startUrl && !playbook.metadata.start_url) {
        result.warnings.push("Missing startUrl/start_url in metadata");
      }
    }

    // 2. Validate steps
    if (!playbook.steps || !Array.isArray(playbook.steps)) {
      result.errors.push("Missing or invalid steps field");
      result.valid = false;
    } else {
      for (let i = 0; i < playbook.steps.length; i++) {
        const stepErrors = this.validateStep(playbook.steps[i], i);
        result.errors.push(...stepErrors.errors);
        result.warnings.push(...stepErrors.warnings);

        if (stepErrors.needsMigration) {
          result.needsMigration = true;
        }
      }
    }

    // Print status
    if (result.valid) {
      console.log(`  ✓ Valid (${result.warnings.length} warnings)`);
    } else {
      console.log(`  ✗ Invalid (${result.errors.length} errors)`);
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
    }

    console.log("");
    return result;
  }

  private validateStep(
    step: any,
    index: number
  ): { errors: string[]; warnings: string[]; needsMigration: boolean } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let needsMigration = false;

    const prefix = `Step ${index + 1}`;

    // Required fields
    if (!step.id) errors.push(`${prefix}: Missing id field`);
    if (!step.action) errors.push(`${prefix}: Missing action field`);

    // Selector validation
    if (!step.selector && !step.selectors) {
      warnings.push(`${prefix}: No selector defined`);
    }

    // Check for smartSelector
    if (!step.smartSelector) {
      warnings.push(
        `${prefix}: Missing smartSelector field (needed for self-healing)`
      );
      needsMigration = true;
    } else {
      // Validate smartSelector structure
      if (!step.smartSelector.primary) {
        errors.push(`${prefix}: smartSelector missing primary field`);
      }
      if (!step.smartSelector.fallbacks && !step.smartSelector.fallback) {
        warnings.push(`${prefix}: smartSelector missing fallbacks array`);
        needsMigration = true;
      }
    }

    // Message for user guidance
    if (!step.message) {
      warnings.push(`${prefix}: Missing message field (user guidance)`);
    }

    return { errors, warnings, needsMigration };
  }

  private printReport(): void {
    console.log("\n" + "=".repeat(60));
    console.log("VALIDATION REPORT");
    console.log("=".repeat(60) + "\n");

    const total = this.results.length;
    const valid = this.results.filter((r) => r.valid).length;
    const invalid = total - valid;
    const needsMigration = this.results.filter((r) => r.needsMigration).length;

    console.log(`Total Playbooks: ${total}`);
    console.log(`✓ Valid: ${valid}`);
    console.log(`✗ Invalid: ${invalid}`);
    console.log(`⚠ Needs Migration: ${needsMigration}\n`);

    // Print invalid playbooks
    if (invalid > 0) {
      console.log("❌ INVALID PLAYBOOKS:");
      this.results
        .filter((r) => !r.valid)
        .forEach((r) => {
          console.log(`  - ${r.name} (${r.playbookId})`);
          r.errors.forEach((err) => console.log(`    ✗ ${err}`));
        });
      console.log("");
    }

    // Print playbooks needing migration
    if (needsMigration > 0) {
      console.log("⚠ PLAYBOOKS NEEDING MIGRATION:");
      this.results
        .filter((r) => r.needsMigration)
        .forEach((r) => {
          console.log(`  - ${r.name} (${r.playbookId})`);
          r.warnings.forEach((warn) => console.log(`    ⚠ ${warn}`));
        });
      console.log("");
    }
  }
}

// Main execution
async function main() {
  const validator = new LocalPlaybookValidator();
  await validator.validateAll();

  console.log("\n✅ Local validation complete!");
  console.log("\nTo validate against actual Supabase:");
  console.log("  1. Ensure internet connection");
  console.log("  2. Run: pnpm run validate-playbooks\n");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
