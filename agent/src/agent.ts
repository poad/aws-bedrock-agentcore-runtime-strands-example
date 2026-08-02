import { tools } from './tools/aws-tool.js';
import { Agent, BedrockModel } from '@strands-agents/sdk';

const createAgent = async (
  {
    session,
    user = 'anonymous',
  }: {
    session: string,
    user?: string,
  },
) => {
  const model = new BedrockModel({
    region: 'us-east-1',
    modelId: 'us.amazon.nova-micro-v1:0',
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

export { createAgent };
