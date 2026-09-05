import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface FrontendDeployStackProps extends cdk.StackProps {
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly distribution: cloudfront.IDistributionRef;
  readonly websiteBucket: s3.IBucket;
  readonly runtimeArn: string;
}

export class FrontendDeployStack extends cdk.Stack {
  public readonly websiteBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: FrontendDeployStackProps) {
    super(scope, id, props);

    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'agentcore-runtime-agent-example-frontend-deploy-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for deploy to S3',
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          'AWSLambdaBasicExecutionRole',
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      inlinePolicies: {
        S3AccessPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              sid: 's3access',
              actions: ['s3:*'],
              resources: [props.websiteBucket.bucketArn, `${props.websiteBucket.bucketArn}/*`],
            }),
          ],
        }),
      },
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.asset('../frontend/dist'),
        s3deploy.Source.jsonData('amplifyconfiguration.json', {
          Auth: {
            Cognito: {
              userPoolId: props.userPoolId,
              userPoolClientId: props.userPoolClientId,
            },
          },
        }),
        s3deploy.Source.jsonData('config.json', {
          region: this.region,
          runtimeArn: props.runtimeArn,
        }),
      ],
      destinationBucket: props.websiteBucket,
      distribution: props.distribution,
      distributionPaths: ['/*'],
      prune: true,
      retainOnDelete: true,
      role: deployRole,
    });
  }
}
