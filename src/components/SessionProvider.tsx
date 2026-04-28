'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider basePath="/web-quiz-app/api/auth">{children}</NextAuthSessionProvider>;
}
