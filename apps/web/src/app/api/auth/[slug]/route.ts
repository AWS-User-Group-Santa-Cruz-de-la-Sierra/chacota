import { createAuthRouteHandlers } from '@/lib/amplify-server';

export const GET = createAuthRouteHandlers({
  redirectOnSignInComplete: '/app',
  redirectOnSignOutComplete: '/',
});
