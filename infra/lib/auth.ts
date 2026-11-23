import { Duration, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface ChacotaAuthProps {
  authDomainPrefix: string;
  /** Origins (https://host) where the web app runs; used for OAuth callback URLs. */
  appOrigins: string[];
  googleOAuthSecretName?: string;
  /** Retain resources and block deletion (production). */
  protect: boolean;
}

export const SUPERADMIN_GROUP = 'superadmin';
/** Routes handled by @aws-amplify/adapter-nextjs createAuthRouteHandlers. */
export const SIGN_IN_CALLBACK_PATH = '/api/auth/sign-in-callback';
export const SIGN_OUT_CALLBACK_PATH = '/api/auth/sign-out-callback';

/**
 * Cognito for leads and admins. Participants never sign in: they join a game
 * with a PIN and a nickname.
 */
export class ChacotaAuth extends Construct {
  readonly userPool: cognito.UserPool;
  readonly webClient: cognito.UserPoolClient;
  readonly domain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: ChacotaAuthProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      passwordPolicy: { minLength: 10, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: props.protect,
      removalPolicy: props.protect ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    new cognito.CfnUserPoolGroup(this, 'SuperadminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: SUPERADMIN_GROUP,
      description: 'Platform admins: approve new organizations',
    });

    const providers = [cognito.UserPoolClientIdentityProvider.COGNITO];
    let google: cognito.UserPoolIdentityProviderGoogle | undefined;
    if (props.googleOAuthSecretName) {
      google = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
        userPool: this.userPool,
        clientId: SecretValue.secretsManager(props.googleOAuthSecretName, { jsonField: 'clientId' }).unsafeUnwrap(),
        clientSecretValue: SecretValue.secretsManager(props.googleOAuthSecretName, { jsonField: 'clientSecret' }),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      });
      providers.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    }

    this.webClient = this.userPool.addClient('WebClient', {
      generateSecret: false,
      supportedIdentityProviders: providers,
      // adminUserPassword lets scripted end-to-end tests get tokens; never enabled in production.
      authFlows: { userSrp: true, adminUserPassword: !props.protect },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: props.appOrigins.map((o) => `${o}${SIGN_IN_CALLBACK_PATH}`),
        logoutUrls: props.appOrigins.map((o) => `${o}${SIGN_OUT_CALLBACK_PATH}`),
      },
    });
    if (google) this.webClient.node.addDependency(google);

    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: props.authDomainPrefix },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    new cognito.CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.webClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });
  }
}
