import { init } from './observability/exporters.js';
import { tools } from './tools/aws-tool.js';
import { Agent, BedrockModel } from '@strands-agents/sdk';
import { setupTracer } from '@strands-agents/sdk/telemetry';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';

const exporters = await init();
if (exporters.trace) {
  const provider = new NodeTracerProvider({
    spanProcessors: [
      // Configure OTLP endpoint programmatically
      new SimpleSpanProcessor(
        exporters.trace,
      ),
    ],
  });
  setupTracer({
    provider,
    exporters: { otlp: true, console: false },
  });
}

const createAgent = ({ model: modelId, session, user = 'anonymous' }: { model: string, session: string, user?: string }) => {
  const model = new BedrockModel({
    region: 'us-east-1',
    modelId: modelId,
    maxTokens: 4096,
  });

  return new Agent({
    model,
    id: 'aws-agent',
    name: 'AWS Agent',
    systemPrompt: `
      You are an assistant that helps architects design systems using Amazon Web Services (AWS). Your primary function is to answer user questions based on AWS knowledge and propose system architectures. When responding, follow these guidelines:

      - If information is not available in aws-knowledge-mcp-server, clearly state that you don't know
      - Always cite your sources
      - When proposing architectures, provide multiple patterns whenever possible
      - Respond in the same language as the question
      - Keep responses concise yet informative
`,
    traceAttributes: {
      'session.id': session,
      'user.id': user,
    },
    tools,
    printer: false,
  });
};

const finalize = async () => {
  await exporters.flush();
};

export { createAgent, finalize };
