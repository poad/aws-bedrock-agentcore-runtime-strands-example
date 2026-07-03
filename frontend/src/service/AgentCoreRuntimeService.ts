/** Stream event types emitted by parsers */
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use_start'; toolUseId: string; name: string }
  | { type: 'tool_use_delta'; toolUseId: string; input: string }
  | { type: 'tool_result'; toolUseId: string; result: string }
  | { type: 'message'; role: string; content: unknown[] }
  | { type: 'result'; stopReason: string }
  | { type: 'lifecycle'; event: string };

/** Parses a single SSE line and emits events via callback */
export type ChunkParser = (line: string, callback: StreamCallback) => void;

/** Callback invoked with each stream event */
export type StreamCallback = (event: StreamEvent) => void;

/**
 * Parses SSE chunks from Strands agents.
 * Emits typed StreamEvents for text, tool use, messages, and lifecycle.
 */
const parseStrandsChunk: ChunkParser = (line, callback) => {
  if (!line.startsWith('data: ')) return;

  const data = line.substring(6).trim();
  if (!data) return;

  try {
    const json = JSON.parse(data);

    // Text streaming
    if (typeof json.data === 'string') {
      callback({ type: 'text', content: json.data });
      return;
    }

    if (typeof json.text === 'string') {
      callback({ type: 'text', content: json.text });
      return;
    }

    // Tool use streaming
    if (json.current_tool_use) {
      const tool = json.current_tool_use;
      // First delta for a tool has empty input — treat as start
      if (json.delta?.toolUse?.input === '') {
        callback({
          type: 'tool_use_start',
          toolUseId: tool.toolUseId,
          name: tool.name,
        });
      } else if (json.delta?.toolUse?.input) {
        callback({
          type: 'tool_use_delta',
          toolUseId: tool.toolUseId,
          input: json.delta.toolUse.input,
        });
      }
      return;
    }

    // Complete message (assistant with toolUse, or user with toolResult)
    if (json.message) {
      const msg = json.message;
      callback({ type: 'message', role: msg.role, content: msg.content });

      // Extract tool results from user messages
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.toolResult) {
            const resultText =
              block.toolResult.content
                ?.map((c: { text?: string }) => c.text)
                .filter(Boolean)
                .join('') || JSON.stringify(block.toolResult.content);
            callback({
              type: 'tool_result',
              toolUseId: block.toolResult.toolUseId,
              result: resultText,
            });
          }
        }
      }
      return;
    }

    // Final result
    if (json.result) {
      callback({
        type: 'result',
        stopReason: typeof json.result === 'object' ? json.result.stop_reason : 'end_turn',
      });
      return;
    }

    // Lifecycle events
    if (json.init_event_loop || json.start_event_loop || json.start) {
      const event = json.init_event_loop ? 'init' : json.start_event_loop ? 'start_loop' : 'start';
      callback({ type: 'lifecycle', event });
      return;
    }
  } catch {
    console.debug('Failed to parse strands event:', data);
  }
};

/** Reads an SSE response stream, passing each line to the parser. */
async function readSSEStream(
  response: Response,
  parser: ChunkParser,
  callback: StreamCallback,
): Promise<void> {
  let buffer = '';

  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          parser(line, callback);
        }
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim()) {
      parser(buffer, callback);
    }
  } finally {
    reader.releaseLock();
  }
}

export const AgentCoreRuntimeService = {

  invoke: async function (
    query: string,
    sessionId: string,
    accessToken: string,
    onEvent: StreamCallback,
    endpoint: string,
  ): Promise<void> {
    if (!accessToken) throw new Error('No valid access token found.');

    const traceId = `1-${Math.floor(Date.now() / 1000).toString(16)}-${crypto.randomUUID()}`;

    const body = {
      message: query,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Amzn-Trace-Id': traceId,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    await readSSEStream(response, parseStrandsChunk, onEvent);
  },
};
