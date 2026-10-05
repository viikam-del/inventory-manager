'use client';

import * as React from 'react';
import { AuditLog, AuditAction } from '@/lib/audit';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimelineProps {
  logs: AuditLog[];
  title?: string;
  className?: string;
  emptyMessage?: string;
}

export function Timeline({
  logs,
  title = 'Activity & Audit Timeline',
  className,
  emptyMessage = 'No activity or audit events recorded yet.',
}: TimelineProps) {
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);

  const getActionConfig = (action: AuditAction) => {
    switch (action) {
      case 'create':
        return {
          label: 'Created',
          color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          dotColor: 'bg-emerald-500',
          badgeVariant: 'success' as const,
          icon: Icons.add,
        };
      case 'fulfill':
        return {
          label: 'Fulfilled / Delivered',
          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          dotColor: 'bg-blue-500',
          badgeVariant: 'info' as const,
          icon: Icons.delivered,
        };
      case 'adjust_stock':
      case 'restock':
        return {
          label: 'Stock Adjusted',
          color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          dotColor: 'bg-purple-500',
          badgeVariant: 'secondary' as const,
          icon: Icons.stockAdjustments,
        };
      case 'credit_override':
        return {
          label: 'Credit Limit Overridden',
          color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          dotColor: 'bg-amber-500',
          badgeVariant: 'warning' as const,
          icon: Icons.shieldAlert,
        };
      case 'update':
        return {
          label: 'Updated',
          color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          dotColor: 'bg-amber-500',
          badgeVariant: 'warning' as const,
          icon: Icons.edit,
        };
      case 'delete':
        return {
          label: 'Deleted / Voided',
          color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
          dotColor: 'bg-red-500',
          badgeVariant: 'destructive' as const,
          icon: Icons.trash,
        };
      case 'payment_received':
        return {
          label: 'Payment Logged',
          color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          dotColor: 'bg-emerald-500',
          badgeVariant: 'success' as const,
          icon: Icons.payments,
        };
      default:
        return {
          label: action,
          color: 'bg-muted text-muted-foreground border-border',
          dotColor: 'bg-muted-foreground',
          badgeVariant: 'secondary' as const,
          icon: Icons.activity,
        };
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return {
        date: d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      };
    } catch {
      return { date: isoStr, time: '' };
    }
  };

  return (
    <div className={cn('bg-card rounded-xl border border-border shadow-xs overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.timeline className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {logs.length} {logs.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="p-5">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icons.clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">{emptyMessage}</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {logs.map((log) => {
              const cfg = getActionConfig(log.action);
              const Icon = cfg.icon;
              const { date, time } = formatDate(log.created_at);
              const isExpanded = expandedLogId === log.id;
              const hasDetails = (log.changes && Object.keys(log.changes).length > 0) || (log.metadata && Object.keys(log.metadata).length > 0);

              return (
                <div key={log.id} className="relative group">
                  {/* Pin Dot on the left line */}
                  <div
                    className={cn(
                      'absolute -left-[1.85rem] top-1 w-3.5 h-3.5 rounded-full border-2 border-background shadow-xs transition-transform group-hover:scale-125',
                      cfg.dotColor
                    )}
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border', cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        by <span className="font-semibold text-primary">{log.actor_name || 'System Operator'}</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
                      <span>{date}</span>
                      <span>•</span>
                      <span>{time}</span>
                    </div>
                  </div>

                  {/* Summary / Metadata Chips */}
                  {log.metadata && (
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {Object.entries(log.metadata).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 text-[11px] text-muted-foreground"
                        >
                          <span className="font-medium text-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="font-mono">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expandable Changes / Diff Details */}
                  {hasDetails && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide Event Snapshot' : 'View Snapshot Details'}
                        <Icons.forward className={cn('w-3 h-3 transition-transform', isExpanded ? 'rotate-90' : '')} />
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-2">
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div>
                              <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                                Field Modifications
                              </div>
                              <div className="grid grid-cols-1 gap-1 text-[11px]">
                                {Object.entries(log.changes).map(([field, delta]) => (
                                  <div key={field} className="flex items-center gap-2 p-1 rounded bg-background border border-border/50">
                                    <span className="font-mono font-medium text-foreground w-28 truncate">{field}:</span>
                                    <span className="text-red-500 dark:text-red-400 line-through truncate max-w-[150px]">
                                      {JSON.stringify(delta?.old ?? 'null')}
                                    </span>
                                    <Icons.forward className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[150px]">
                                      {JSON.stringify(delta?.new ?? 'null')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="pt-1">
                              <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                                Raw Context
                              </div>
                              <pre className="p-2 rounded bg-background border border-border/50 text-[10px] font-mono text-muted-foreground overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
