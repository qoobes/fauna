import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { TopNav } from '@/components/layout/TopNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in');

  return (
    <>
      <TopNav userEmail={session.user.email} />
      <main>{children}</main>
    </>
  );
}
