import { buildFrontend } from './process/setup.js';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
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

    buildFrontend({
      userPoolId: props.userPoolId,
      clientId: props.userPoolClientId,
      region: this.region,
      runtimeArn: props.runtimeArn,
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../frontend/dist')],
      destinationBucket: props.websiteBucket,
      distribution: props.distribution,
      distributionPaths: ['/*'],
    });
  }
}
