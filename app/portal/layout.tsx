// Portal routes now live inside the normal CRM admin shell.
// This layout is a transparent pass-through.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
