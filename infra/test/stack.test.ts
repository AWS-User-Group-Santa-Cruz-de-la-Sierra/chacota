import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ChacotaStack } from '../lib/chacota-stack.js';
import type { ChacotaConfig } from '../lib/config.js';

const base: ChacotaConfig = {
  stage: 'test',
  domainName: 'chacota.example.org',
  authDomainPrefix: 'chacota-test',
  monthlyBudgetUsd: 20,
  extraCallbackOrigins: ['http://localhost:3000'],
  loadTest: false,
};

function synth(overrides: Partial<ChacotaConfig> = {}) {
  // Skip bundling the Lambda in unit tests; the template is what we assert on.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const stack = new ChacotaStack(app, 'Test', { config: { ...base, ...overrides }, env: { region: 'us-east-1' } });
  return Template.fromStack(stack);
}

describe('ChacotaStack', () => {
  it('creates an on-demand single table with TTL and a GSI', () => {
    synth().hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      GlobalSecondaryIndexes: [Match.objectLike({ IndexName: 'gsi1' })],
    });
  });

  it('keeps the media bucket private', () => {
    synth().hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('registers OAuth callbacks for production and local origins', () => {
    synth().hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: [
        'https://chacota.example.org/api/auth/sign-in-callback',
        'http://localhost:3000/api/auth/sign-in-callback',
      ],
      SupportedIdentityProviders: ['COGNITO'],
      GenerateSecret: false,
    });
  });

  it('adds Google sign-in only when a secret is configured', () => {
    synth().resourceCountIs('AWS::Cognito::UserPoolIdentityProvider', 0);
    const withGoogle = synth({ googleOAuthSecretName: 'chacota/google' });
    withGoogle.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', { ProviderName: 'Google' });
    withGoogle.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: Match.arrayWith(['COGNITO', 'Google']),
    });
  });

  it('creates the superadmin group', () => {
    synth().hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'superadmin' });
  });

  it('adds the budget only with an alert email', () => {
    synth().resourceCountIs('AWS::Budgets::Budget', 0);
    const t = synth({ budgetEmail: 'alerts@example.org' });
    t.resourceCountIs('AWS::Budgets::Budget', 1);
    expect(JSON.stringify(t.toJSON())).toContain('alerts@example.org');
  });
});

describe('stages', () => {
  it('protects production data', () => {
    const t = synth({ stage: 'prod' });
    t.hasResourceProperties('AWS::DynamoDB::GlobalTable', { Replicas: [Match.objectLike({ DeletionProtectionEnabled: true })] });
    t.hasResourceProperties('AWS::Cognito::UserPool', { DeletionProtection: 'ACTIVE' });
    t.hasResourceProperties('AWS::Cognito::UserPoolDomain', { Domain: 'chacota-test' });
  });

  it('lets dev stacks be destroyed and suffixes the login domain', () => {
    const t = synth({ stage: 'dev' });
    t.hasResourceProperties('AWS::DynamoDB::GlobalTable', { Replicas: [Match.objectLike({ DeletionProtectionEnabled: false })] });
    t.hasResourceProperties('AWS::Cognito::UserPool', { DeletionProtection: 'INACTIVE' });
    t.hasResourceProperties('AWS::Cognito::UserPoolDomain', { Domain: 'chacota-test-dev' });
  });
});

describe('live games', () => {
  const t = synth();

  it('lets participants subscribe with an API key but only IAM publish', () => {
    t.hasResourceProperties('AWS::AppSync::ChannelNamespace', {
      Name: 'game',
      SubscribeAuthModes: [{ AuthType: 'API_KEY' }],
      PublishAuthModes: [{ AuthType: 'AWS_IAM' }],
    });
  });

  it('runs the participant API on arm64 Node 22 with throttling', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      Environment: { Variables: Match.objectLike({ ALLOWED_ORIGINS: 'https://chacota.example.org,http://localhost:3000' }) },
    });
    t.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingBurstLimit: 2000, ThrottlingRateLimit: 1000 },
    });
  });
});
