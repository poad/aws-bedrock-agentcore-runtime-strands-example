import '@aws-amplify/ui-react/styles.css';
import '../index.css';

export function SignOutButton({ signOut }: { signOut: (() => void) | undefined }) {
  return <button onClick={signOut}>Sign out</button>;
}
