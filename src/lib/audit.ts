import { supabase } from './supabase';

export type AuditEntityType =
  | 'sales_order'
  | 'product'
  | 'customer'
  | 'supplier'
  | 'payment'
  | 'stock_adjustment'
  | 'customer_return'
  | 'supplier_return';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'fulfill'
  | 'restock'
  | 'adjust_stock'
  | 'credit_override'
  | 'payment_received';

export interface AuditLog {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  actor_name: string | null;
  actor_email: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Log an audit event asynchronously.
 * Wrapped in try/catch to never disrupt transaction flows if logging fails or table isn't migrated yet.
 */
export async function logAuditEvent(
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  changes?: Record<string, { old: unknown; new: unknown }> | null,
  metadata?: Record<string, unknown> | null,
  actorName?: string,
  actorEmail?: string
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      changes: changes || null,
      metadata: metadata || null,
      actor_name: actorName || 'System User',
      actor_email: actorEmail || null,
    });
  } catch (err) {
    console.warn('[Audit Log] Failed to record audit event:', err);
  }
}

/**
 * Retrieve audit history for a specific entity.
 */
export async function getAuditLogsForEntity(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50
): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[Audit Log] Query error:', error);
      return [];
    }
    return (data as AuditLog[]) || [];
  } catch (err) {
    console.warn('[Audit Log] Exception while fetching entity audit logs:', err);
    return [];
  }
}

/**
 * System-wide audit log query with optional multi-attribute filters.
 */
export async function getSystemAuditLogs(filters?: {
  entityType?: AuditEntityType;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query.limit(filters?.limit || 100);

    if (error) {
      console.warn('[Audit Log] Query error:', error);
      return [];
    }

    let results = (data as AuditLog[]) || [];

    if (filters?.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase();
      results = results.filter(log =>
        log.actor_name?.toLowerCase().includes(q) ||
        log.entity_id.toLowerCase().includes(q) ||
        JSON.stringify(log.metadata || {}).toLowerCase().includes(q) ||
        JSON.stringify(log.changes || {}).toLowerCase().includes(q)
      );
    }

    return results;
  } catch (err) {
    console.warn('[Audit Log] Exception while fetching system audit logs:', err);
    return [];
  }
}
