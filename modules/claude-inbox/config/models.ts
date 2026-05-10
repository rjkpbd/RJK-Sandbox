export interface ModelConfig {
  id: string;
  displayName: string;
  contextWindow: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  supportsVision: boolean;
  supportsPdf: boolean;
  supportsWebSearch: boolean;
  description: string;
}

export const MODELS: ModelConfig[] = [
  {
    id: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    contextWindow: 200_000,
    inputCostPerMillion: 15,
    outputCostPerMillion: 75,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: true,
    description: "Most capable — best for complex reasoning and analysis",
  },
  {
    id: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    contextWindow: 200_000,
    inputCostPerMillion: 15,
    outputCostPerMillion: 75,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: false,
    description: "Highly capable with strong reasoning",
  },
  {
    id: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    contextWindow: 200_000,
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: false,
    description: "Balanced performance and cost",
  },
  {
    id: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    contextWindow: 200_000,
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4,
    supportsVision: true,
    supportsPdf: false,
    supportsWebSearch: false,
    description: "Fast and cost-efficient",
  },
] as const;

export const DEFAULT_MODEL_ID = "claude-opus-4-7";
export const DEFAULT_MODEL = MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

export function computeCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const model = getModel(modelId);
  if (!model) return 0;
  return (
    (inputTokens / 1_000_000) * model.inputCostPerMillion +
    (outputTokens / 1_000_000) * model.outputCostPerMillion
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
