// ═══════════════════════════════════════════════════
// CAPABILITY: contextual-code-synthesis
// Generates entire TypeScript modules from natural
// language specs by combining code-template-compiler
// with multi-modal-reasoning. The system can now
// write its own code from intent descriptions.
// Built on: code-template-compiler + multi-modal-reasoning
// ═══════════════════════════════════════════════════

import { compileTemplate, inferTemplate, getTemplates, type CompiledModule } from './code-template-compiler';
import { reason, type ReasoningOutput } from './multi-modal-reasoning';

export interface SynthesisSpec {
  name: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
  constraints?: string[];
}

export interface SynthesisResult {
  module: CompiledModule;
  reasoning: ReasoningOutput;
  confidence: number;
  warnings: string[];
  suggestedTests: string[];
}

/**
 * Synthesize a TypeScript module from a natural language spec.
 * Combines template compilation with multi-modal reasoning
 * to produce working code from intent descriptions.
 */
export function synthesizeModule(spec: SynthesisSpec): SynthesisResult {
  const warnings: string[] = [];

  // Step 1: Reason about the spec to understand intent
  const reasoning = reason({
    mode: 'text',
    text: `${spec.description}. Inputs: ${spec.inputs?.join(', ') || 'none'}. Outputs: ${spec.outputs?.join(', ') || 'none'}. Constraints: ${spec.constraints?.join(', ') || 'none'}.`,
    question: `What kind of module should "${spec.name}" be?`,
  });

  // Step 2: Choose the best template
  const templateId = inferTemplate(spec.description);
  const templates = getTemplates();
  const template = templates.find(t => t.id === templateId);

  if (!template) {
    warnings.push(`No template matched — using capability-module default`);
  }

  // Step 3: Build placeholder values from spec
  const values: Record<string, string | string[]> = {};

  if (templateId === 'capability-module') {
    values['CAPABILITY_NAME'] = toKebabCase(spec.name);
    values['DESCRIPTION'] = spec.description;
    values['BUILT_ON'] = spec.dependencies || [];
    values['MAIN_FUNCTION'] = toCamelCase(spec.name);
    values['INPUT_TYPE'] = `${toPascalCase(spec.name)}Input`;
    values['OUTPUT_TYPE'] = `${toPascalCase(spec.name)}Result`;
  } else if (templateId === 'engine-module') {
    values['ENGINE_NAME'] = toPascalCase(spec.name);
    values['DESCRIPTION'] = spec.description;
  } else if (templateId === 'utility-module') {
    values['MODULE_NAME'] = spec.name;
    values['FUNCTIONS'] = spec.outputs?.join(', ') || spec.name;
  } else if (templateId === 'test-module') {
    values['TARGET_MODULE'] = spec.name;
    values['IMPORT_PATH'] = `@/lib/${toKebabCase(spec.name)}`;
  }

  // Step 4: Compile the template
  const module = compileTemplate(templateId, values);
  if (!module) {
    // Fallback: generate a minimal module
    const fallbackModule: CompiledModule = {
      fileName: `src/lib/${toKebabCase(spec.name)}.ts`,
      content: generateFallbackModule(spec),
      exports: [toCamelCase(spec.name)],
      dependencies: spec.dependencies || [],
    };
    return {
      module: fallbackModule,
      reasoning,
      confidence: 0.4,
      warnings: [...warnings, 'Template compilation failed — used fallback generator'],
      suggestedTests: generateTestSuggestions(spec),
    };
  }

  // Step 5: Enhance the compiled module with spec-specific logic
  let content = module.content;

  // Add imports for dependencies
  if (spec.dependencies && spec.dependencies.length > 0) {
    const importLines = spec.dependencies
      .map(dep => `// Depends on: ${dep}`)
      .join('\n');
    content = importLines + '\n\n' + content;
  }

  // Add constraint comments
  if (spec.constraints && spec.constraints.length > 0) {
    const constraintBlock = spec.constraints
      .map(c => `// CONSTRAINT: ${c}`)
      .join('\n');
    content = content.replace(
      `export function`,
      `${constraintBlock}\nexport function`
    );
  }

  // Step 6: Calculate confidence
  const confidence = calculateConfidence(spec, reasoning, warnings);

  return {
    module: { ...module, content },
    reasoning,
    confidence,
    warnings,
    suggestedTests: generateTestSuggestions(spec),
  };
}

/**
 * Batch-synthesize multiple modules from specs
 */
export function synthesizeBatch(specs: SynthesisSpec[]): SynthesisResult[] {
  return specs.map(spec => synthesizeModule(spec));
}

/**
 * Analyze existing code and suggest what module could be synthesized to complement it
 */
export function suggestComplement(existingCode: string, existingCapabilities: string[]): SynthesisSpec | null {
  const analysis = reason({
    mode: 'code',
    code: existingCode,
    question: 'What complementary module would enhance this code?',
  });

  if (!analysis.structuralAnalysis) return null;

  // If code has no tests, suggest a test module
  if (!analysis.structuralAnalysis.hasTests) {
    return {
      name: 'auto-test-suite',
      description: `Test suite for code with exports: ${analysis.structuralAnalysis.exports.join(', ')}`,
      inputs: analysis.structuralAnalysis.exports,
      outputs: ['test-results'],
      dependencies: [],
      constraints: ['Must test all exported functions', 'Should include edge cases'],
    };
  }

  // If code is high complexity, suggest a simplification module
  if (analysis.structuralAnalysis.complexity === 'high') {
    return {
      name: 'complexity-reducer',
      description: `Decompose high-complexity module (${analysis.structuralAnalysis.lineCount} lines) into smaller units`,
      inputs: analysis.structuralAnalysis.exports,
      outputs: ['simplified-modules'],
      dependencies: existingCapabilities.slice(0, 3),
    };
  }

  return null;
}

// ─── Helpers ───────────────────────────────────────

function generateFallbackModule(spec: SynthesisSpec): string {
  const funcName = toCamelCase(spec.name);
  return `// ═══════════════════════════════════════════════════
// AUTO-SYNTHESIZED: ${spec.name}
// ${spec.description}
// ═══════════════════════════════════════════════════

export interface ${toPascalCase(spec.name)}Input {
  ${(spec.inputs || ['data']).map(i => `${toCamelCase(i)}: unknown;`).join('\n  ')}
}

export interface ${toPascalCase(spec.name)}Result {
  success: boolean;
  ${(spec.outputs || ['result']).map(o => `${toCamelCase(o)}: unknown;`).join('\n  ')}
}

export function ${funcName}(input: ${toPascalCase(spec.name)}Input): ${toPascalCase(spec.name)}Result {
  return {
    success: true,
    ${(spec.outputs || ['result']).map(o => `${toCamelCase(o)}: null,`).join('\n    ')}
  };
}`;
}

function generateTestSuggestions(spec: SynthesisSpec): string[] {
  const tests: string[] = [];
  tests.push(`it('should export ${toCamelCase(spec.name)} function')`);
  if (spec.inputs) {
    tests.push(`it('should accept ${spec.inputs.join(', ')} as inputs')`);
  }
  if (spec.outputs) {
    tests.push(`it('should produce ${spec.outputs.join(', ')} as outputs')`);
  }
  if (spec.constraints) {
    for (const c of spec.constraints) {
      tests.push(`it('should enforce: ${c}')`);
    }
  }
  return tests;
}

function calculateConfidence(spec: SynthesisSpec, reasoning: ReasoningOutput, warnings: string[]): number {
  let confidence = 0.7; // base

  // Better spec = higher confidence
  if (spec.inputs && spec.inputs.length > 0) confidence += 0.05;
  if (spec.outputs && spec.outputs.length > 0) confidence += 0.05;
  if (spec.constraints && spec.constraints.length > 0) confidence += 0.05;
  if (spec.dependencies && spec.dependencies.length > 0) confidence += 0.05;

  // Reasoning insights boost confidence
  confidence += Math.min(0.1, reasoning.insights.length * 0.02);

  // Warnings reduce confidence
  confidence -= warnings.length * 0.1;

  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
