// File: mobile/app/index.tsx
import { Redirect } from 'expo-router';

// Root redirect: send users to auth flow on first open
export default function Index() {
  return <Redirect href="/(auth)/phone" />;
}
