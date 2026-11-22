import type { Node } from 'constructs';

export interface ChacotaConfig {
  /** Deployment stage, used in resource names: "prod", "dev"... */
  stage: string;
  /** Public domain of the web app, e.g. chacota.awsug.scz.net */
  domainName: string;
  /** Globally unique prefix for the Cognito hosted login domain. */
  authDomainPrefix: string;
  /** Optional Secrets Manager secret holding {"clientId","clientSecret"} for Google sign-in. */
  googleOAuthSecretName?: string;
  /** Email that receives AWS Budget alerts. Pass with -c chacota:budgetEmail=... */
  budgetEmail?: string;
  monthlyBudgetUsd: number;
  /** Extra origins allowed for OAuth callbacks (local development). */
  extraCallbackOrigins: string[];
}

export function readConfig(node: Node): ChacotaConfig {
  const get = <T>(key: string): T | undefined => node.tryGetContext(`chacota:${key}`) as T | undefined;
  const required = <T>(key: string): T => {
    const value = get<T>(key);
    if (value === undefined || value === '') throw new Error(`Missing CDK context "chacota:${key}"`);
    return value;
  };
  const origins = get<string[] | string>('extraCallbackOrigins') ?? [];
  return {
    stage: required('stage'),
    domainName: required('domainName'),
    authDomainPrefix: required('authDomainPrefix'),
    googleOAuthSecretName: get('googleOAuthSecretName'),
    budgetEmail: get('budgetEmail'),
    monthlyBudgetUsd: Number(get('monthlyBudgetUsd') ?? 20),
    extraCallbackOrigins: typeof origins === 'string' ? origins.split(',') : origins,
  };
}
