import { loadToasterConfig } from './ollama-toaster';

const isElectron = typeof window !== 'undefined' && typeof (window as any).require === 'function';

const VISION_PROMPT = `You are analyzing a screenshot of a web application preview.
Describe ONLY visual issues you see, in plain English. Focus on:
- Layout problems (overlapping elements, misalignment, clipped content, wrong sizing)
- Color issues (poor contrast, wrong dark/light mode colors, invisible text)
- Missing or broken UI elements (blank areas, broken images, placeholder text still showing)
- Responsive/spacing issues (elements too close, too far apart, not centered)

Be precise and concise. If the UI looks correct, say "No visual issues detected."
Do NOT describe what the app does or its functionality — only describe what looks wrong visually.

Example output: "The submit button overlaps the input field by ~10px on the right. The header text is nearly invisible (white on light gray). The sidebar has no bottom padding, content is clipped."`;

export async function capturePreviewScreenshot(port?: number): Promise<string | null> {
  if (!isElectron) return null;
  try {
    const ipcRenderer = (window as any).require('electron').ipcRenderer;
    const result = await ipcRenderer.invoke('capture-preview-screenshot', port ?? null);
    if (result.success && result.base64) return result.base64;
    console.warn('Vision: screenshot capture failed:', result.error);
    return null;
  } catch (e) {
    console.warn('Vision: screenshot IPC failed:', e);
    return null;
  }
}

export async function analyzeScreenshot(base64: string, context?: string): Promise<string> {
  const cfg = loadToasterConfig();
  const userPrompt = context
    ? `${VISION_PROMPT}\n\nAdditional context: ${context}`
    : VISION_PROMPT;

  try {
    const resp = await fetch(`${cfg.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava',
        messages: [
          { role: 'user', content: userPrompt, images: [base64] },
        ],
        stream: false,
        options: { temperature: 0.1, num_predict: 512 },
        keep_alive: '5m',
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      if (resp.status === 404) return '';
      throw new Error(`Ollama ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    return (data.message?.content || '').trim();
  } catch (e: any) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      console.warn('Vision: llava analysis timed out');
      return '';
    }
    console.warn('Vision: llava analysis failed:', e.message);
    return '';
  }
}

export async function checkVisionAvailable(): Promise<boolean> {
  const cfg = loadToasterConfig();
  try {
    const resp = await fetch(`${cfg.endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    const models = data.models || [];
    return models.some((m: any) => (m.name || '').includes('llava'));
  } catch {
    return false;
  }
}

export async function captureAndDescribe(
  port?: number,
  context?: string
): Promise<{ description: string; screenshot: string } | null> {
  const base64 = await capturePreviewScreenshot(port);
  if (!base64) return null;

  const description = await analyzeScreenshot(base64, context);
  if (!description) return null;

  return { description, screenshot: base64 };
}
