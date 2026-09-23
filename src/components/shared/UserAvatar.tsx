import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function initials(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  name: string | undefined | null;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function UserAvatar({ name, size = 'default', className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="font-medium text-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
