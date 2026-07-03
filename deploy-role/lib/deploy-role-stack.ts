import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class DeployRoleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cdkDeployPolicy = iam.ManagedPolicy.fromManagedPolicyName(this, 'CdkDeployPolicy', 'CdkDeployMinimalPolicy');

    new iam.Role(this, 'Role', {
      roleName: 'aws-bedrock-agentcore-runtime-strands-example-deploy-role',
      assumedBy: new iam.FederatedPrincipal(
        `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`, {
          StringLike: {
            'token.actions.githubusercontent.com:sub': 'repo:poad/aws-bedrock-agentcore-runtime-strands-example:*',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ).withSessionTags(),
      managedPolicies: [
        cdkDeployPolicy,
      ],
      inlinePolicies: {
        'iam-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'AttachRolePolicy',
                'CreateRole',
                'CreatePolicy',
                'CreatePolicyVersion',
                'CreateServiceLinkedRole',
                'DeletePolicy',
                'DeletePolicyVersion',
                'DeleteRole',
                'DeleteRolePermissionsBoundary',
                'DeleteRolePolicy',
                'GetPolicy',
                'GetPolicyVersion',
                'GetRole',
                'GetRolePolicy',
                'ListAttachedRolePolicies',
                'ListPolicies',
                'ListPoliciesGrantingServiceAccess',
                'ListPolicyTags',
                'ListPolicyVersions',
                'ListRolePolicies',
                'ListRoleTags',
                'ListRoles',
                'PutRolePermissionsBoundary',
                'PutRolePolicy',
                'TagPolicy',
                'TagRole',
                'UntagPolicy',
                'UntagRole',
                'UpdateRole',
                'UpdateRoleDescription',
              ].map((action) => `iam:${action}`),
              resources: ['*'],
            }),
          ],
        }),
      },
    });
  }
}
