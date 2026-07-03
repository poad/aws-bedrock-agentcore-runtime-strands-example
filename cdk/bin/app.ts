#!/usr/bin/env node
import { AgentCoreStack } from '../lib/runtime-stack.js';
import { FrontendStack } from '../lib/frontend-stack.js';
import { FrontendDeployStack } from '../lib/frontend-deploy-stack.js';
import { AuthStack } from '../lib/auth-stack.js';
import * as cdk from 'aws-cdk-lib/core';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Frontend stack (depends on runtime and auth stacks)
const cdnStack = new FrontendStack(app, 'AwsBedrockAgentcoreRuntimeStrandsExampleFrontend', {
  env,
  description: 'AgentCore Frontend: CloudFront-hosted React interface with direct AgentCore integration',
});

// Auth stack (Cognito User Pool)
const authStack = new AuthStack(app, 'AwsBedrockAgentcoreRuntimeStrandsExampleAuth', {
  env,
  distributionUrl: cdnStack.distributionUrl,
  description: 'AgentCore Authentication: Cognito User Pool for API access',
});
authStack.node.addDependency(cdnStack);

// Runtime stack (depends on infra and auth stacks)
const agentStack = new AgentCoreStack(app, 'AwsBedrockAgentcoreRuntimeStrandsExampleAgentCoreRuntime', {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  description: 'AgentCore Runtime: Container-based agent with built-in Cognito authentication',
});
agentStack.node.addDependency(authStack);

const deploy = new FrontendDeployStack(app, 'AwsBedrockAgentcoreRuntimeStrandsExampleFrontendDeploy', {
  env,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  distribution: cdnStack.distribution,
  websiteBucket: cdnStack.websiteBucket,
  runtimeArn: agentStack.agentRuntimeArn,
});
deploy.node.addDependency(agentStack);

app.synth();
