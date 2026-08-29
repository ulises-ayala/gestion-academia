import { PermissionGate } from '../../components/permission-gate';
export default function AuditLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PermissionGate permission="audit:read">{children}</PermissionGate>;
}
