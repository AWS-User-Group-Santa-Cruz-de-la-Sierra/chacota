import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';
import type { ChacotaGame } from './game.js';
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Optional (-c chacota:loadTest=true): Lambdas that simulate hundreds of players from inside AWS. */
export class ChacotaLoadTest extends Construct {
  constructor(scope: Construct, id: string, props: { game: ChacotaGame; table: dynamodb.ITableV2 }) {
    super(scope, id);
    const fn = new NodejsFunction(this, 'Function', {
      entry: `${repoRoot}services/game/scripts/load-lambda.ts`,
      projectRoot: repoRoot,
      depsLockFilePath: `${repoRoot}pnpm-lock.yaml`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.minutes(15),
      logGroup: new logs.LogGroup(this, 'Logs', { retention: logs.RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY }),
      bundling: {
        format: OutputFormat.ESM,
        minify: true,
        target: 'node22',
        mainFields: ['module', 'main'],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        CHACOTA_TABLE: props.table.tableName,
        GAME_API_URL: props.game.api.apiEndpoint,
        EVENTS_HTTP_DNS: props.game.events.httpDns,
        EVENTS_REALTIME_DNS: props.game.events.realtimeDns,
        EVENTS_API_KEY: props.game.apiKey,
      },
    });
    props.table.grantReadWriteData(fn);
    props.game.events.grantPublish(fn);
    // The orchestrator invokes the same function as workers.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [`arn:aws:lambda:${Stack.of(this).region}:${Stack.of(this).account}:function:*LoadTest*`],
      }),
    );
    new CfnOutput(Stack.of(this), 'LoadTestFunction', { value: fn.functionName });
  }
}
