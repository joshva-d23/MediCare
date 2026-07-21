const PROVIDER = (process.env['PROVIDER'] || 'openai').toLowerCase();

export interface ChatMessage {
  role: string;
  content: string;
}

export interface CallModelArgs {
  systemPrompt: string;
  messages: ChatMessage[];
}

export async function callModel({ systemPrompt, messages }: CallModelArgs): Promise<string> {
  if (PROVIDER === 'openai') return callOpenAI({ systemPrompt, messages });
  if (PROVIDER === 'anthropic') return callAnthropic({ systemPrompt, messages });
  if (PROVIDER === 'nvidia') return callNVIDIA({ systemPrompt, messages });
  throw new Error(
    `Unknown PROVIDER "${PROVIDER}" in .env — use "openai", "anthropic", or "nvidia".`
  );
}

async function callOpenAI({ systemPrompt, messages }: CallModelArgs): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY in .env — add your key, then restart the server.'
    );
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${body.slice(0, 400)}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

async function callAnthropic({ systemPrompt, messages }: CallModelArgs): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY in .env — add your key, then restart the server.'
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env['ANTHROPIC_MODEL'] || 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic error (${response.status}): ${body.slice(0, 400)}`);
  }

  const data = await response.json() as any;
  return data.content.map((block: any) => block.text || '').join('');
}

async function callNVIDIA({ systemPrompt, messages }: CallModelArgs): Promise<string> {
  const apiKey = process.env['NVIDIA_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'Missing NVIDIA_API_KEY in .env — add your nvapi- key, then restart the server.'
    );
  }

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env['NVIDIA_MODEL'] || 'meta/llama-3.1-8b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NVIDIA error (${response.status}): ${body.slice(0, 400)}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

export function getModelConfig() {
  const configs: Record<string, { model: string }> = {
    openai: { model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini' },
    anthropic: { model: process.env['ANTHROPIC_MODEL'] || 'claude-3-5-sonnet-latest' },
    nvidia: { model: process.env['NVIDIA_MODEL'] || 'meta/llama-3.1-8b-instruct' },
  };
  const cfg = configs[PROVIDER] || { model: 'unknown' };
  return { provider: PROVIDER, model: cfg.model };
}
