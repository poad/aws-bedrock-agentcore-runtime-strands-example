import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  readonly distributionUrl: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.IUserPool;
  public readonly userPoolClient: cognito.IUserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'AgentCoreUserPool', {
      userPoolName: 'agentcore-users',
      selfSignUpEnabled: false,
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      signInPolicy: {
        allowedFirstAuthFactors: {
          password: true,
          emailOtp: true,
          smsOtp: false,
          passkey: true,
        },
      },
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev - change to RETAIN for prod
    });

    // User Pool Client for frontend
    this.userPoolClient = new cognito.UserPoolClient(this, 'AgentCoreUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'agentcore-web-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false, // Public client (frontend)
      preventUserExistenceErrors: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [
          props.distributionUrl,
          'http://localhost:5173/', // ローカル開発用
        ],
        logoutUrls: [
          props.distributionUrl,
          'http://localhost:5173/',
        ],
      },
    });
  }
}
