import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface AgentCoreStackProps extends cdk.StackProps {
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
}

export class AgentCoreStack extends cdk.Stack {
  public readonly agentRuntimeArn: string;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const { region, account: accountId } = this;

    const sourceBucket = new s3.Bucket(
      this,
      'SourceBucket',
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      },
    );

    // Create IAM role for Bedrock AgentCore with required policies
    const agentCoreRole = new iam.Role(this, 'BedrockAgentCoreRole', {
      roleName: 'agentcore-runtime-agent-example-role',
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'IAM role for Bedrock AgentCore Runtime',
      inlinePolicies: {
        'BedrockAgentCoreRuntimePolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              sid: 'BedrockModelInvocation',
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListInferenceProfiles',
                'bedrock:GetInferenceProfile',
              ],
              resources: [
                'arn:aws:bedrock:*::foundation-model/*',
                `arn:aws:bedrock:${region}:${accountId}:foundation-model/*`,
                `arn:aws:bedrock:${region}:${accountId}:application-inference-profile/*`,
                `arn:aws:bedrock:${region}:${accountId}:inference-profile/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
              resources: [`arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:DescribeLogGroups'],
              resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [`arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['cloudwatch:PutMetricData'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'cloudwatch:namespace': 'bedrock-agentcore',
                },
              },
            }),
            new iam.PolicyStatement({
              sid: 'GetAgentAccessToken',
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock-agentcore:GetWorkloadAccessToken',
                'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
                'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
              ],
              resources: [
                `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
                `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/agentName-*`,
              ],
            }),
          ],
        }),
      },
    });

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const agentRuntimeArtifact = bedrockagentcore.AgentRuntimeArtifact.fromCodeAsset({
      path: path.join(__dirname, '../../agent'), // package.json, index.ts等があるディレクトリ
      runtime: bedrockagentcore.AgentCoreRuntime.NODE_22, // ← お使いのCDKバージョンで実際の値を要確認
      entrypoint: ['dist/index.js'],
    });

    // Step 1: Upload only the essential agent files (exclude heavy directories)
    new s3deploy.BucketDeployment(this, 'AgentSourceUpload', {
      sources: [s3deploy.Source.asset('../agent', {
        exclude: [
          'venv/**',           // Python virtual environment (can be 100+ MB)
          '__pycache__/**',    // Python cache files
          '*.pyc',             // Compiled Python files
          '.git/**',           // Git files
          'node_modules/**',   // Node modules if any
          '.DS_Store',         // macOS files
          '*.log',             // Log files
          'build/**',          // Build artifacts
          'dist/**',           // Distribution files
        ],
      })],
      destinationBucket: sourceBucket,
      destinationKeyPrefix: 'agent-source/',
      prune: false,
      retainOnDelete: false,
    });

    const agentRuntime = new bedrockagentcore.Runtime(this, 'MyAgentRuntime', {
      runtimeName: 'my_ts_agent',
      agentRuntimeArtifact,
      authorizerConfiguration: bedrockagentcore.RuntimeAuthorizerConfiguration.usingCognito(
        props.userPool,
        [props.userPoolClient],
      ),
      executionRole: agentCoreRole,
    });

    // Store runtime info for frontend
    this.agentRuntimeArn = agentRuntime.agentRuntimeArn;
  }
}
