import { CfnOutput, Stack, Tags, type StackProps } from 'aws-cdk-lib';
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
    if (config.loadTest) new ChacotaLoadTest(this, 'LoadTest', { game: this.game, table: this.data.table });

    if (config.budgetEmail) {
      new ChacotaBudget(this, 'Budget', { name: `chacota-${config.stage}-monthly`, monthlyUsd: config.monthlyBudgetUsd, email: config.budgetEmail });
    }

    new CfnOutput(this, 'TableName', { value: this.data.table.tableName });
    new CfnOutput(this, 'MediaBucketName', { value: this.data.mediaBucket.bucketName });
    new CfnOutput(this, 'MediaUrl', { value: `https://${this.data.mediaDistribution.distributionDomainName}` });
    new CfnOutput(this, 'WebServerPolicyArn', { value: this.data.webServerPolicy.managedPolicyArn });
    new CfnOutput(this, 'UserPoolId', { value: this.auth.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.auth.webClient.userPoolClientId });
    new CfnOutput(this, 'AuthDomain', { value: this.auth.domain.baseUrl() });
  }
}
