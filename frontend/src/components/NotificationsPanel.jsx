import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check } from '@phosphor-icons/react';

export default function NotificationsPanel({ open, onClose, notifications, onMarkRead, onMarkAllRead }) {
  const getNotificationText = (notif) => {
    const { type, payload } = notif;
    switch (type) {
      case 'project_liked':
        return `${payload?.likerName || 'Someone'} liked your project "${payload?.projectTitle}"`;
      case 'student_followed':
        return `${payload?.followerName || 'A recruiter'} started following you`;
      case 'project_created':
        return `Project "${payload?.projectTitle}" was created`;
      default:
        return 'New activity on your profile';
    }
  };

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-md bg-card overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
          <SheetTitle className="text-lg font-bold">Notifications</SheetTitle>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead} className="text-xs text-primary hover:text-primary-foreground mr-7">
              Mark all read
            </Button>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {unread.length > 0 && (
            <div className="px-3 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unread</h3>
              {unread.map(n => (
                <div key={n.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-accent/20">
                  <div className="text-xs leading-relaxed text-foreground">
                    <p>{getNotificationText(n)}</p>
                    <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onMarkRead(n.id)}>
                    <Check size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Previous</h3>
            {read.length === 0 && unread.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No notifications yet.</p>
            )}
            {read.map(n => (
              <div key={n.id} className="p-3 rounded-lg border border-border/40 opacity-70">
                <p className="text-xs text-foreground leading-relaxed">{getNotificationText(n)}</p>
                <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
