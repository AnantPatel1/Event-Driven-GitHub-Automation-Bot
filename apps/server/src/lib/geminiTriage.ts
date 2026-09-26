import { env } from '../config/env.js';
import { AiTriageResult } from '@github-bot/shared';

export interface TriageInput {
  title: string;
  body?: string;
  eventType: string;
  author?: string;
}

export class GeminiTriageService {
  /**
   * Triages a GitHub Issue or Pull Request using Google Gemini 1.5 Flash API
   * with intelligent heuristic fallback when no API key is provided.
   */
  static async triage(input: TriageInput): Promise<AiTriageResult> {
    const apiKey = env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim().length > 0 && !apiKey.startsWith('mock_')) {
      try {
        const result = await this.callGeminiApi(apiKey, input);
        if (result) {
          return result;
        }
      } catch (err: any) {
        console.warn(`⚠️ Gemini 1.5 Flash API call failed (${err.message}). Falling back to heuristic classifier.`);
      }
    }

    // Heuristic fallback classifier
    return this.heuristicTriage(input);
  }

  /**
   * Calls Google Generative Language API for Gemini 1.5 Flash
   */
  private static async callGeminiApi(apiKey: string, input: TriageInput): Promise<AiTriageResult | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `You are an automated engineering triage bot. Analyze this GitHub ${input.eventType === 'pull_request' ? 'pull request' : 'issue'} and return a JSON object with:
1. "summary": A crisp, high-level 1-sentence technical explanation of what this issue/PR is reporting or proposing.
2. "suggestedLabel": Exactly one of ["bug", "enhancement", "documentation", "security", "question"].
3. "priority": Exactly one of ["P0", "P1", "P2", "P3"] where P0=Critical/Emergency, P1=High/Broken, P2=Medium/Normal, P3=Low/Minor.
4. "priorityReason": A brief 1-sentence rationale for the priority score.
5. "confidence": A float between 0.0 and 1.0 representing confidence.

Title: ${input.title}
Author: ${input.author || 'Unknown'}
Description:
${input.body && input.body.trim().length > 0 ? input.body.slice(0, 2000) : 'No description provided.'}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText.slice(0, 150)}`);
    }

    const data = (await response.json()) as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return null;
    }

    const parsed = JSON.parse(rawText) as {
      summary?: string;
      suggestedLabel?: string;
      priority?: string;
      priorityReason?: string;
      confidence?: number;
    };

    const validLabels = ['bug', 'enhancement', 'documentation', 'security', 'question'];
    const validPriorities = ['P0', 'P1', 'P2', 'P3'] as const;

    const suggestedLabel = validLabels.includes(parsed.suggestedLabel || '') ? parsed.suggestedLabel! : 'bug';
    const priority = validPriorities.includes((parsed.priority as any) || '') ? (parsed.priority as any) : 'P2';

    return {
      summary: parsed.summary || `Automated triage for: ${input.title}`,
      suggestedLabel,
      priority,
      priorityReason: parsed.priorityReason || 'Assessed based on technical severity and impact.',
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.95,
      provider: 'Google Gemini 1.5 Flash',
    };
  }

  /**
   * Fast, resilient heuristic fallback triage when offline or when no Gemini API key is configured
   */
  private static heuristicTriage(input: TriageInput): AiTriageResult {
    const combined = `${input.title} ${input.body || ''}`.toLowerCase();

    // Critical security / outage indicators (P0)
    if (
      combined.includes('vulnerability') ||
      combined.includes('cve') ||
      combined.includes('exploit') ||
      combined.includes('data breach') ||
      combined.includes('outage')
    ) {
      return {
        summary: `Critical security report: ${input.title}`,
        suggestedLabel: 'security',
        priority: 'P0',
        priorityReason: 'Identified high-severity security or vulnerability keywords in payload.',
        confidence: 0.9,
        provider: 'Gemini Classifier (Heuristic Engine)',
      };
    }

    // High severity bugs (P1)
    if (
      combined.includes('crash') ||
      combined.includes('fatal') ||
      combined.includes('exception') ||
      combined.includes('panic') ||
      combined.includes('bug') ||
      combined.includes('broken') ||
      combined.includes('regression')
    ) {
      return {
        summary: `Application defect reported: ${input.title}`,
        suggestedLabel: 'bug',
        priority: 'P1',
        priorityReason: 'Identified functional failure or software defect indicators.',
        confidence: 0.88,
        provider: 'Gemini Classifier (Heuristic Engine)',
      };
    }

    // Documentation (P3)
    if (
      combined.includes('docs') ||
      combined.includes('documentation') ||
      combined.includes('readme') ||
      combined.includes('typo') ||
      combined.includes('guide')
    ) {
      return {
        summary: `Documentation update: ${input.title}`,
        suggestedLabel: 'documentation',
        priority: 'P3',
        priorityReason: 'Identified documentation or copy modification scope.',
        confidence: 0.92,
        provider: 'Gemini Classifier (Heuristic Engine)',
      };
    }

    // Feature request / enhancement (P2)
    if (
      combined.includes('feature') ||
      combined.includes('feat:') ||
      combined.includes('enhancement') ||
      combined.includes('support for') ||
      combined.includes('add ')
    ) {
      return {
        summary: `Feature proposal: ${input.title}`,
        suggestedLabel: 'enhancement',
        priority: 'P2',
        priorityReason: 'Identified new capability or enhancement proposal.',
        confidence: 0.85,
        provider: 'Gemini Classifier (Heuristic Engine)',
      };
    }

    // Default triage
    return {
      summary: `Standard triage analysis for: ${input.title}`,
      suggestedLabel: input.eventType === 'pull_request' ? 'enhancement' : 'question',
      priority: 'P2',
      priorityReason: 'Standard priority assigned pending maintainer review.',
      confidence: 0.8,
      provider: 'Gemini Classifier (Heuristic Engine)',
    };
  }
}
