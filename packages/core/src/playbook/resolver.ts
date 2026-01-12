import type { Playbook, PlaybookStep } from '../types';

export interface ResolvedStep extends PlaybookStep {
  parentPlaybookId?: string;
}

export interface ResolvedPlaybook {
  id: string;
  level: 'scenario';
  steps: ResolvedStep[];
  aliases: string[];
}

export interface PlaybookLoader {
  load(id: string): Promise<Playbook>;
}

export interface TemplateStep {
  template: string;
  variables?: Record<string, string>;
}

function isTemplateStep(step: PlaybookStep | TemplateStep): step is TemplateStep {
  return 'template' in step && typeof step.template === 'string';
}

export class PlaybookResolver {
  private templateCache = new Map<string, PlaybookStep[]>();

  constructor(private loader: PlaybookLoader) {}

  async resolve(playbookId: string): Promise<ResolvedPlaybook> {
    const playbook = await this.loader.load(playbookId);
    const steps: ResolvedStep[] = [];

    for (const step of playbook.steps as (PlaybookStep | TemplateStep)[]) {
      if (isTemplateStep(step)) {
        const templateSteps = await this.loadTemplate(step.template);
        const expanded = this.applyVariables(templateSteps, step.variables || {});
        steps.push(
          ...expanded.map((s) => ({
            ...s,
            parentPlaybookId: playbookId,
          }))
        );
      } else {
        steps.push({
          ...step,
          parentPlaybookId: playbookId,
        });
      }
    }

    return {
      id: playbookId,
      level: 'scenario',
      steps,
      aliases: playbook.metadata.aliases || [],
    };
  }

  private async loadTemplate(templatePath: string): Promise<PlaybookStep[]> {
    const cached = this.templateCache.get(templatePath);
    if (cached) {
      return cached;
    }

    const template = await this.loader.load(templatePath);
    this.templateCache.set(templatePath, template.steps);
    return template.steps;
  }

  private applyVariables(
    steps: PlaybookStep[],
    variables: Record<string, string>
  ): PlaybookStep[] {
    return steps.map((step) => {
      const serialized = JSON.stringify(step);
      const replaced = serialized.replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => variables[key] || `{{${key}}}`
      );
      return JSON.parse(replaced) as PlaybookStep;
    });
  }

  clearCache(): void {
    this.templateCache.clear();
  }
}
