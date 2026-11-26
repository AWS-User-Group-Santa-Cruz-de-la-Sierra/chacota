export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fails server startup if CHACOTA_LOCAL_AUTH=emulator is set on Amplify or a non-localhost build.
    const { localAuthMode } = await import('./lib/local-auth');
    localAuthMode();
  }
}
