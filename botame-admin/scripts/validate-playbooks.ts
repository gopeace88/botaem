/**
 * Supabase Playbook Validation & Migration Script
 *
 * This script validates and migrates playbooks from Supabase to match current schema
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Playbook, PlaybookStep, SmartSelector } from "@botame/types";
import * as fs from "fs/promises";
import * as path from "path";

// Validation Result
interface ValidationResult {
  valid: boolean;
  playbookId: string;
  name: string;
  errors: string[];
  warnings: string[];
  needsMigration: boolean;
}

// Migration Result
interface MigrationResult {
  playbookId: string;
  name: string;
  migrated: boolean;
  backupPath?: string;
}

class PlaybookValidator {
  private supabase: SupabaseClient;
  private results: ValidationResult[] = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Validate all playbooks from Supabase
   */
  async validateAll(): Promise<ValidationResult[]> {
    console.log("📋 Fetching playbooks from Supabase...\n");

    const { data: playbooks, error } = await this.supabase
      .from("playbooks")
      .select("*");

    if (error) {
      console.error("❌ Error fetching playbooks:", error.message);
      throw error;
    }

    console.log(`✓ Found ${playbooks.length} playbooks\n`);

    for (const playbook of playbooks) {
      const result = await this.validatePlaybook(playbook);
      this.results.push(result);
    }

    this.printReport();
    return this.results;
  }

  /**
   * Validate a single playbook
   */
  private async validatePlaybook(playbook: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      playbookId: playbook.playbook_id,
      name: playbook.name,
      errors: [],
      warnings: [],
      needsMigration: false,
    };

    console.log(`🔍 Validating: ${playbook.name} (${playbook.playbook_id})`);

    // 1. Check metadata fields
    if (!playbook.metadata) {
      result.errors.push("Missing metadata field");
      result.valid = false;
    } else {
      // Check for aliases (new field)
      if (!playbook.metadata.aliases) {
        result.warnings.push("Missing aliases field in metadata");
        result.needsMigration = true;
      }

      // Check start_url field naming
      if (playbook.metadata.startUrl && !playbook.metadata.start_url) {
        result.warnings.push("Using startUrl instead of start_url (camelCase)");
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

    // 3. Print status
    if (result.valid) {
      console.log(`  ✓ Valid (warnings: ${result.warnings.length})`);
    } else {
      console.log(`  ✗ Invalid (${result.errors.length} errors)`);
    }

    if (result.warnings.length > 0) {
      console.log(`  ⚠ Warnings: ${result.warnings.length}`);
    }

    console.log("");

    return result;
  }

  /**
   * Validate a single step
   */
  private validateStep(
    step: any,
    index: number,
  ): { errors: string[]; warnings: string[]; needsMigration: boolean } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let needsMigration = false;

    const prefix = `Step ${index + 1}`;

    // Required fields
    if (!step.id) {
      errors.push(`${prefix}: Missing id field`);
    }
    if (!step.action) {
      errors.push(`${prefix}: Missing action field`);
    }

    // Selector validation
    if (!step.selector && !step.selectors) {
      warnings.push(`${prefix}: No selector defined`);
    }

    // Check for smartSelector (critical for self-healing)
    if (!step.smartSelector) {
      warnings.push(
        `${prefix}: Missing smartSelector field (needed for self-healing)`,
      );
      needsMigration = true;
    } else {
      // Validate smartSelector structure
      if (!step.smartSelector.primary) {
        errors.push(`${prefix}: smartSelector missing primary field`);
      }
      if (
        !step.smartSelector.fallback ||
        !Array.isArray(step.smartSelector.fallback)
      ) {
        warnings.push(
          `${prefix}: smartSelector missing or invalid fallback array`,
        );
        needsMigration = true;
      }
    }

    // Message for user guidance
    if (!step.message) {
      warnings.push(`${prefix}: Missing message field (user guidance)`);
    }

    return { errors, warnings, needsMigration };
  }

  /**
   * Print validation report
   */
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

  /**
   * Migrate playbooks to new schema
   */
  async migrate(outputDir: string): Promise<MigrationResult[]> {
    const migrationResults: MigrationResult[] = [];
    const playbooksToMigrate = this.results.filter(
      (r) => r.needsMigration && r.valid,
    );

    console.log(`\n🔄 Migrating ${playbooksToMigrate.length} playbooks...\n`);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    for (const result of playbooksToMigrate) {
      try {
        // Fetch full playbook data
        const { data: playbook } = await this.supabase
          .from("playbooks")
          .select("*")
          .eq("playbook_id", result.playbookId)
          .single();

        if (!playbook) {
          console.log(`  ⚠ Skipping ${result.name}: Not found`);
          continue;
        }

        // Create backup
        const backupPath = path.join(
          outputDir,
          `${result.playbookId}-backup.json`,
        );
        await fs.writeFile(backupPath, JSON.stringify(playbook, null, 2));

        // Migrate playbook
        const migratedPlaybook = this.migratePlaybook(playbook);

        // Update Supabase
        const { error: updateError } = await this.supabase
          .from("playbooks")
          .update({
            steps: migratedPlaybook.steps,
            metadata: migratedPlaybook.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("playbook_id", result.playbookId);

        if (updateError) {
          console.log(
            `  ✗ ${result.name}: Migration failed - ${updateError.message}`,
          );
          migrationResults.push({
            playbookId: result.playbookId,
            name: result.name,
            migrated: false,
          });
        } else {
          console.log(`  ✓ ${result.name}: Migrated successfully`);
          migrationResults.push({
            playbookId: result.playbookId,
            name: result.name,
            migrated: true,
            backupPath,
          });
        }
      } catch (error) {
        console.log(
          `  ✗ ${result.name}: Error - ${error instanceof Error ? error.message : error}`,
        );
        migrationResults.push({
          playbookId: result.playbookId,
          name: result.name,
          migrated: false,
        });
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(
      `MIGRATION COMPLETE: ${migrationResults.filter((r) => r.migrated).length}/${playbooksToMigrate.length} successful`,
    );
    console.log("=".repeat(60) + "\n");

    return migrationResults;
  }

  /**
   * Migrate a single playbook to new schema
   */
  private migratePlaybook(playbook: any): Playbook {
    const migrated: any = { ...playbook };

    // 1. Ensure metadata structure
    if (!migrated.metadata) {
      migrated.metadata = {};
    }

    // Add aliases if missing
    if (!migrated.metadata.aliases) {
      // Generate aliases from name
      migrated.metadata.aliases = this.generateAliases(migrated.name);
    }

    // Handle startUrl/start_url
    if (migrated.metadata.startUrl && !migrated.metadata.start_url) {
      migrated.metadata.start_url = migrated.metadata.startUrl;
    }

    // 2. Migrate steps
    if (migrated.steps && Array.isArray(migrated.steps)) {
      migrated.steps = migrated.steps.map((step: any) =>
        this.migrateStep(step),
      );
    }

    return migrated as Playbook;
  }

  /**
   * Migrate a single step
   */
  private migrateStep(step: any): PlaybookStep {
    const migrated: any = { ...step };

    // Add smartSelector if missing
    if (!migrated.smartSelector) {
      const smartSelector: SmartSelector = {
        primary: step.selector || "",
        fallback: [],
      };

      // Try to generate fallback selectors from primary
      if (step.selector) {
        smartSelector.fallback = this.generateFallbackSelectors(step.selector);
      }

      migrated.smartSelector = smartSelector;
    }

    // Ensure fallback is array
    if (
      migrated.smartSelector &&
      !Array.isArray(migrated.smartSelector.fallback)
    ) {
      migrated.smartSelector.fallback = [];
    }

    return migrated as PlaybookStep;
  }

  /**
   * Generate aliases from name
   */
  private generateAliases(name: string): string[] {
    // Simple alias generation (can be enhanced)
    const aliases: string[] = [];

    // Add shortened version
    if (name.length > 10) {
      aliases.push(name.substring(0, 10) + "...");
    }

    // Add keywords from name
    const words = name.split(/\s+/);
    if (words.length > 1) {
      aliases.push(words.slice(0, 2).join(" "));
    }

    return aliases;
  }

  /**
   * Generate fallback selectors from primary
   */
  private generateFallbackSelectors(primary: string): string[] {
    const fallbacks: string[] = [];

    // Basic fallback strategies
    if (primary.includes("#")) {
      // Has ID - try class as fallback
      const classMatch = primary.match(/\.([\w-]+)/);
      if (classMatch) {
        fallbacks.push(primary.replace(/#[\w-]+/, classMatch[0]));
      }
    }

    if (primary.includes("[")) {
      // Has attribute - try tag name
      const tagMatch = primary.match(/^(\w+)/);
      if (tagMatch) {
        fallbacks.push(tagMatch[1]);
      }
    }

    return fallbacks;
  }
}

// Main execution
async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set",
    );
    process.exit(1);
  }

  const validator = new PlaybookValidator(supabaseUrl, supabaseKey);

  // Validate all playbooks
  await validator.validateAll();

  // Ask if user wants to migrate
  const needsMigration = validator["results"].filter(
    (r) => r.needsMigration && r.valid,
  );

  if (needsMigration.length > 0) {
    console.log(`\n⚠ ${needsMigration.length} playbooks need migration.`);
    console.log("Run with MIGRATE=true environment variable to migrate:\n");
    console.log("  MIGRATE=true pnpm run validate-playbooks\n");
  }

  if (process.env.MIGRATE === "true") {
    const outputDir = "./playbook-migrations";
    await validator.migrate(outputDir);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { PlaybookValidator };
