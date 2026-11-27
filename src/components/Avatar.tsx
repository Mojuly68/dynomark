import { UserRound } from 'lucide-react';
import type { User } from '../types';
import { cx } from './ui';

/** Profile photo, or initials on lime when there is none. Decorative: callers label the link or button around it. */
export function Avatar({ user, size, className }: { user: Pick<User, 'name' | 'photo'>; size: number; className?: string }) {
  const initials = (user.name || '').trim().slice(0, 2).toUpperCase();
  return user.photo ? (
    <img src={user.photo} alt="" width={size} height={size} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center rounded-full bg-accent font-display font-black text-accent-ink', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{initials || <UserRound size={Math.round(size * 0.5)} />}</span>
  );
}
