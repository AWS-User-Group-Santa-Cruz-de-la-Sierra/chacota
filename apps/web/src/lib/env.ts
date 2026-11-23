import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See apps/web/.env.example`);
  return value;
}

export const env = {
  get origin() {
    return required('AMPLIFY_APP_ORIGIN');
  },
  /** Address players use to join (shown with the QR). Defaults to the app origin. */
  get publicOrigin() {
    return process.env.CHACOTA_PUBLIC_ORIGIN || required('AMPLIFY_APP_ORIGIN');
  },
  get cognito() {
    return {
      userPoolId: required('COGNITO_USER_POOL_ID'),
      clientId: required('COGNITO_CLIENT_ID'),
      domain: required('COGNITO_DOMAIN'),
    };
  },
  get autoApproveOrgs() {
    return process.env.CHACOTA_AUTO_APPROVE_ORGS === 'true';
  },
  get googleEnabled() {
    return process.env.CHACOTA_GOOGLE_ENABLED === 'true';
  },
};
