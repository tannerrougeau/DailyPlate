/**
 * Claude provider for food-scan. The key comes from ANTHROPIC_API_KEY (server only); the model from
 * SCAN_MODEL. The reply is always a report_scan tool call (strict tool use), validated again here.
 */
import Anthropic from "@anthropic-ai/sdk";
import { SCAN_RESULT_SCHEMA, validateScanResult } from "../schema";
import type { RecognizeOptions, ScanContext, ScanImage, ScanProvider, ScanResult } from "../types";

export const DEFAULT_SCAN_MODEL = "claude-haiku-5-5";
export const SCAN_TOOL_NAME = "report_scan";

/** Don't start another attempt with less time than this left. */
const MIN_ATTEMPT_MS = 4000;

export const SCAN_SYSTEM_PROMPT = `You identify food in a photo for a meal-tracking app. Always answer by calling the ${SCAN_TOOL_NAME} tool exactly once.

Decide what the photo mainly shows:
- "label": a Nutrition Facts panel. Copy the values exactly as printed. If the label has two columns (per serving and per package/container), use the per-serving column. Put grams in servingSize.grams only if a gram weight is printed; otherwise null. For productName, use the product name from the label or, if the front of the package is visible, from the front; otherwise null.
  If more than one Nutrition Facts panel is visible (side by side, two products, or two different labels), set multipleLabels to true, set label to null and don't read any of them. Otherwise multipleLabels is false.
- "barcode": a barcode is the main subject. Give its printed digits if you can read all of them, otherwise null.
- "food": food or a meal, including packaged food without a readable label or barcode. List each distinct food as an item with a plain, searchable name (as you would type it into a food database), the brand if a package or wrapper shows one, an estimated portion (amount, unit and grams), and notes only for things that change nutrition (fried, breaded, creamy sauce, visible oil or butter, cheese, dressing). List the main food first. Never estimate calories or other nutrients for foods.
  For a whole or shared dish (a whole pizza, cake, pie, casserole, tray of lasagna), the portion is the whole item, and whole gives the whole item and its serving unit, e.g. name "12-inch pizza", servings 8, unit "slice", gramsPerServing 80. Use the singular unit. For everything else whole is null.
- "unknown": not food, or you can't tell.

Confidence is 0 to 1. Be honest: use low confidence when the photo is unclear, and add up to 3 likely names to suggestions. If a planned meal is given, say whether the photo shows that meal (plannedMeal.matches) and how sure you are; otherwise plannedMeal is null. Fields that don't apply are null (or [] for items).`;

export function contextText(context: ScanContext): string {
  const lines = [`Meal slot: ${context.slot}.`];
  if (context.plannedMeal) {
    lines.push(`Planned meal: ${context.plannedMeal.name}.`);
    if (context.plannedMeal.ingredients.length > 0) {
      lines.push(`Its ingredients: ${context.plannedMeal.ingredients.slice(0, 25).join("; ")}.`);
    }
  } else {
    lines.push("No planned meal: set plannedMeal to null.");
  }
  return lines.join("\n");
}

const SCAN_TOOL = {
  name: SCAN_TOOL_NAME,
  description: "Report what the photo shows: a food or meal, a Nutrition Facts label, a barcode, or unknown.",
  input_schema: SCAN_RESULT_SCHEMA,
  strict: true,
} as unknown as Anthropic.Tool;

export class ScanProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "no_tool_call" | "invalid_reply" | "refusal" | "max_tokens" | "deadline" | "api",
  ) {
    super(message);
  }
}

type MessagesClient = Pick<Anthropic, "messages">;

export function createClaudeProvider(opts: { model?: string; client?: MessagesClient } = {}): ScanProvider {
  const model = opts.model?.trim() || DEFAULT_SCAN_MODEL;
  let client = opts.client;
  return {
    name: "claude",
    model,
    async recognize(image: ScanImage, context: ScanContext, options: RecognizeOptions = {}): Promise<ScanResult> {
      // Created on first use so a missing key surfaces as a logged scan failure, not a crash at load.
      client ??= new Anthropic({ maxRetries: 1 });
      const timeLeft = options.timeLeftMs ?? (() => 45_000);
      // One retry when the model answers without calling the tool, time permitting.
      for (let attempt = 1; attempt <= 2; attempt++) {
        const left = timeLeft();
        if (left < MIN_ATTEMPT_MS) throw new ScanProviderError("Scan deadline reached", "deadline");
        const response = await client.messages.create(
          {
            model,
            max_tokens: 2000,
            system: SCAN_SYSTEM_PROMPT,
            tools: [SCAN_TOOL],
            tool_choice: { type: "auto" },
            output_config: { effort: "low" },
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
                  { type: "text", text: contextText(context) },
                ],
              },
            ],
          },
          // The SDK's own retry shares this deadline: each attempt gets only the time that's left.
          { timeout: left, maxRetries: 1, signal: options.signal },
        );
        const stop = response.stop_reason as string | null;
        if (stop === "refusal") throw new ScanProviderError("Provider declined the request", "refusal");
        if (stop === "max_tokens") throw new ScanProviderError("Reply hit max_tokens", "max_tokens");
        const call = response.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === SCAN_TOOL_NAME,
        );
        if (!call) {
          if (attempt === 2) throw new ScanProviderError("No report_scan call in the reply", "no_tool_call");
          continue;
        }
        const result = validateScanResult(call.input);
        if (!result) throw new ScanProviderError("report_scan input failed validation", "invalid_reply");
        return result;
      }
      throw new ScanProviderError("No report_scan call in the reply", "no_tool_call");
    },
  };
}

/** A short, key-free description of a provider error for the function log. */
export function describeProviderError(e: unknown): string {
  if (e instanceof ScanProviderError) return `${e.kind}: ${e.message}`;
  if (e instanceof Anthropic.RateLimitError) return `rate_limited (HTTP 429)`;
  if (e instanceof Anthropic.AuthenticationError) return `auth_failed (HTTP 401): check ANTHROPIC_API_KEY`;
  if (e instanceof Anthropic.APIUserAbortError) return "aborted at the scan deadline";
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "timed out";
  if (e instanceof Anthropic.APIError) return `api_error (HTTP ${e.status ?? "?"}): ${e.message}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
