import { FaunaWordmark } from '@/components/brand/FaunaWordmark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
    }}>
      <div style={{ marginBottom: 56 }}>
        <FaunaWordmark size={18} />
      </div>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {children}
      </div>
    </div>
  );
}
