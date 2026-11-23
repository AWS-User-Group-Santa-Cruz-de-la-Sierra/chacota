import { CfnOutput, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ChacotaAuth } from './auth.js';
import { ChacotaBudget } from './budget.js';
import type { ChacotaConfig } from './config.js';
import { ChacotaData } from './data.js';
import { ChacotaGame } from './game.js';
import { ChacotaLoadTest } from './load-test.js';

export interface ChacotaStackProps extends StackProps {
  config: ChacotaConfig;
}

export class ChacotaStack extends Stack {
  readonly data: ChacotaData;
  readonly auth: ChacotaAuth;
  readonly game: ChacotaGame;
  readonly webComputeRole: iam.Role;

  constructor(scope: Construct, id: string, props: ChacotaStackProps) {
    super(scope, id, props);
    const { config } = props;
    Tags.of(this).add('project', 'chacota');
    Tags.of(this).add('stage', config.stage);

    const appOrigins = [`https://${config.domainName}`, ...config.extraCallbackOrigins];
    const protect = config.stage === 'prod';

    this.data = new ChacotaData(this, 'Data', { allowedOrigins: appOrigins, protect });
    this.auth = new ChacotaAuth(this, 'Auth', {
      authDomainPrefix: protect ? config.authDomainPrefix : `${config.authDomainPrefix}-${config.stage}`,
      appOrigins,
      googleOAuthSecretName: config.googleOAuthSecretName,
      protect,
    });
    this.game = new ChacotaGame(this, 'Game', { table: this.data.table, allowedOrigins: appOrigins, protect });
    // Role the Amplify Hosting SSR compute assumes: the web server reads and writes the table,
    // publishes presenter events and signs media uploads.
    this.webComputeRole = new iam.Role(this, 'WebComputeRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Amplify SSR compute role for the Chacota web app',
      managedPolicies: [this.data.webServerPolicy],
    });
    this.data.table.grantReadWriteData(this.webComputeRole);
    this.game.events.grantPublish(this.webComputeRole);

    if (config.loadTest) new ChacotaLoadTest(this, 'LoadTest', { game: this.game, table: this.data.table });

    if (config.budgetEmail) {
      new ChacotaBudget(this, 'Budget', { name: `chacota-${config.stage}-monthly`, monthlyUsd: config.monthlyBudgetUsd, email: config.budgetEmail });
    }

    new CfnOutput(this, 'TableName', { value: this.data.table.tableName });
    new CfnOutput(this, 'MediaBucketName', { value: this.data.mediaBucket.bucketName });
    new CfnOutput(this, 'MediaUrl', { value: `https://${this.data.mediaDistribution.distributionDomainName}` });
    new CfnOutput(this, 'WebServerPolicyArn', { value: this.data.webServerPolicy.managedPolicyArn });
    new CfnOutput(this, 'WebComputeRoleArn', { value: this.webComputeRole.roleArn });
    new CfnOutput(this, 'UserPoolId', { value: this.auth.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.auth.webClient.userPoolClientId });
    new CfnOutput(this, 'AuthDomain', { value: this.auth.domain.baseUrl() });
  }
}
