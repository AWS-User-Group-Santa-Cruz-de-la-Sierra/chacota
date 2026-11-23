#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ChacotaStack } from '../lib/chacota-stack.js';
import { readConfig } from '../lib/config.js';

const app = new App();
const config = readConfig(app.node);

new ChacotaStack(app, `Chacota-${config.stage}`, {
  config,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  description: 'Chacota: community games for meetups and streams',
});
