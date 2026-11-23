import { CfnOutput, Duration, Expiration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export interface ChacotaGameProps {
  table: dynamodb.ITableV2;
  allowedOrigins: string[];
  protect: boolean;
}

/**
 * Live games: AppSync Events for fan-out (participants subscribe with an API key,
 * only IAM principals can publish) and a Lambda behind an HTTP API for join/answer.
 */
export class ChacotaGame extends Construct {
  readonly events: appsync.EventApi;
  readonly api: apigw.HttpApi;
  readonly apiKey: string;
  readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: ChacotaGameProps) {
    super(scope, id);
    const stack = Stack.of(this);

    const apiKeyProvider: appsync.AppSyncAuthProvider = {
      authorizationType: appsync.AppSyncAuthorizationType.API_KEY,
      // API keys last at most 365 days: redeploy before then to rotate.
      apiKeyConfig: { expires: Expiration.after(Duration.days(364)) },
    };
    const iamProvider: appsync.AppSyncAuthProvider = { authorizationType: appsync.AppSyncAuthorizationType.IAM };

    this.events = new appsync.EventApi(this, 'Events', {
      apiName: `${stack.stackName}-events`,
      authorizationConfig: {
        authProviders: [apiKeyProvider, iamProvider],
        connectionAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        defaultSubscribeAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        defaultPublishAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM],
      },
    });
    this.events.addChannelNamespace('Game', {
      channelNamespaceName: 'game',
      authorizationConfig: {
        subscribeAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        publishAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM],
      },
    });
    this.apiKey = Object.values(this.events.apiKeys)[0]!.attrApiKey;

    const tokenSecret = new secretsmanager.Secret(this, 'PlayerTokenSecret', {
      description: 'HMAC key for Chacota player tokens',
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
      removalPolicy: props.protect ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.fn = new NodejsFunction(this, 'ApiFunction', {
      entry: `${repoRoot}services/api/src/lambda.ts`,
      projectRoot: repoRoot,
      depsLockFilePath: `${repoRoot}pnpm-lock.yaml`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      logGroup: new logs.LogGroup(this, 'ApiLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: { format: OutputFormat.ESM, minify: true, sourceMap: true, target: 'node22', mainFields: ['module', 'main'],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
      environment: {
        CHACOTA_TABLE: props.table.tableName,
        EVENTS_HTTP_DNS: this.events.httpDns,
        GAME_TOKEN_SECRET_ARN: tokenSecret.secretArn,
        ALLOWED_ORIGINS: props.allowedOrigins.join(','),
        NODE_OPTIONS: '--enable-source-maps',
      },
    });
    props.table.grantReadWriteData(this.fn);
    tokenSecret.grantRead(this.fn);
    this.events.grantPublish(this.fn);

    this.api = new apigw.HttpApi(this, 'HttpApi', {
      apiName: `${stack.stackName}-game`,
      corsPreflight: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowHeaders: ['content-type', 'authorization'],
        maxAge: Duration.hours(1),
      },
      defaultIntegration: new HttpLambdaIntegration('Integration', this.fn),
    });
    // Caps abuse: ~1000 players answering within a few seconds fits comfortably.
    const stage = this.api.defaultStage!.node.defaultChild as apigw.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 2000, throttlingRateLimit: 1000 };

    new CfnOutput(stack, 'GameApiUrl', { value: this.api.apiEndpoint });
    new CfnOutput(stack, 'EventsHttpDns', { value: this.events.httpDns });
    new CfnOutput(stack, 'EventsRealtimeDns', { value: this.events.realtimeDns });
    new CfnOutput(stack, 'EventsApiKey', { value: this.apiKey });
  }
}
