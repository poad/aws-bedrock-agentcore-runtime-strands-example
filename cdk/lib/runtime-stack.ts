import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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

    const databricksClientId = this.node.tryGetContext('databricks-client-id');
    const databricksClientSecret = this.node.tryGetContext('databricks-client-secret');
    const databricksWorkspaceHost = this.node.tryGetContext('databricks-workdpace-host');

    const databricksUcSchemaName = this.node.tryGetContext('databricksUcSchemaName');
    const databricksUcTablePrefix = this.node.tryGetContext('databricksUcTablePrefix');

    const secret = cdk.SecretValue.unsafePlainText(databricksClientSecret);
    const databricksProvider = bedrockagentcore.OAuth2CredentialProvider.usingCustom(this, 'DatabricksOAuthProvider', {
      oAuth2CredentialProviderName: 'databricks-telemetry-provider',
      clientId: databricksClientId,
      clientSecret: secret,
      authorizationServerMetadata: {
        issuer: `https://${databricksWorkspaceHost}/oidc`,
        authorizationEndpoint: `https://${databricksWorkspaceHost}/oidc/v1/authorize`,
        tokenEndpoint: `https://${databricksWorkspaceHost}/oidc/v1/token`,
      },
    });

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const agentRuntimeArtifact = bedrockagentcore.AgentRuntimeArtifact.fromCodeAsset({
      path: path.join(__dirname, '../../agent/.agentcore-staging'),
      runtime: bedrockagentcore.AgentCoreRuntime.NODE_22,
      entrypoint: ['dist/index.js'],
      deployTime: true,
    });

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
                `arn:aws:bedrock:*:${accountId}:inference-profile/*`,
                `arn:aws:bedrock:${region}:${accountId}:foundation-model/*`,
                `arn:aws:bedrock:${region}:${accountId}:application-inference-profile/*`,
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
        'BedrockAgentCoreIdentityPolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock-agentcore:GetResourceOauth2Token'],
              resources: [
                databricksProvider.credentialProviderArn,
                `arn:aws:bedrock-agentcore:${this.region}:${this.account}:token-vault/default`,
                `arn:aws:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default`,
                `arn:aws:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default/workload-identity/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue'],
              resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:bedrock-agentcore-identity!default/oauth2/databricks-telemetry-provider*`],
            }),
          ],
        }),
      },
    });

    const agentRuntime = new bedrockagentcore.Runtime(this, 'MyAgentRuntime', {
      runtimeName: 'my_ts_agent',
      agentRuntimeArtifact,
      authorizerConfiguration: bedrockagentcore.RuntimeAuthorizerConfiguration.usingCognito(
        props.userPool,
        [props.userPoolClient],
      ),
      executionRole: agentCoreRole,
      environmentVariables: {
        DATABRICKS_OAUTH_PROVIDER_NAME: databricksProvider.oAuth2CredentialProviderName, // 'databricks-telemetry-provider'
        DATABRICKS_HOST: databricksWorkspaceHost,
        DATABRICKS_UC_SCHEMA_NAME: databricksUcSchemaName,
        ENABLE_TRACING: 'true',
        ENABLE_LOGS: 'true',
        ENABLE_METRICS: 'true',
        DATABRICKS_WORKSPACE_URL: `https://${databricksWorkspaceHost}`,
        DATABRICKS_UC_TABLE_PREFIX: databricksUcTablePrefix,
      },
    });

    // Store runtime info for frontend
    this.agentRuntimeArn = agentRuntime.agentRuntimeArn;
  }
}
