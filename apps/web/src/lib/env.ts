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
  /** Logos and images: bucket, public base URL and how the browser uploads. See .env.example. */
  get media() {
    return {
      bucket: required('MEDIA_BUCKET'),
      publicUrl: required('MEDIA_PUBLIC_URL'),
      /** presigned: PUT to S3 with a signed URL. local: PUT to the local server (AWS Emulator). */
      uploadMode: process.env.MEDIA_UPLOAD_MODE === 'local' ? ('local' as const) : ('presigned' as const),
    };
  },
  get googleEnabled() {
    return process.env.CHACOTA_GOOGLE_ENABLED === 'true';
  },
};
