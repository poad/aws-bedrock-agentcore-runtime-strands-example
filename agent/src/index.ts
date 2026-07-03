import { createAgent, finalize } from './agent.js';
import { logger } from './logger.js';
import { BedrockAgentCoreApp } from 'bedrock-agentcore/runtime';
import { z } from 'zod';

interface Request { message: string, model?: string, session: string }

async function* handle(
  {
    message: message = 'こんにちは！',
    model: model = 'us.amazon.nova-micro-v1:0',
    session,
  }: Request) {
  const agent = createAgent({ model, session });
  try {
    for await (const event of agent.stream(message)) {
      logger.trace('[Event]', event.type);
      if (event.type === 'modelStreamUpdateEvent') {
        if (event.event.type === 'modelContentBlockDeltaEvent' &&
          event.event.delta.type === 'textDelta') {
          if (event.event.delta.type === 'textDelta') {
            yield { event: 'message', data: { text: event.event.delta.text } };
          }
        }
      }
    }
  } finally {
    await finalize();
  }
};

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema: z.object({ message: z.string(), model: z.string().optional(), session: z.string() }),
    process: handle,
  },
});

app.run();
