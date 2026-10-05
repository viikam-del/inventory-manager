'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  AuditLog,
  AuditEntityType,
  AuditAction,
  getSystemAuditLogs,
} from '@/lib/audit';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Modal } from '@/components/ui/modal';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import { cn } from '@/lib/utils';

const ENTITY_TYPE_LABELS: Record<AuditEntityType, { label: string; icon: any; color: string }> = {
  sales_order: { label: 'Sales Order', icon: Icons.sales, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  product: { label: 'Product', icon: Icons.products, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  customer: { label: 'Customer', icon: Icons.customers, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  supplier: { label: 'Supplier', icon: Icons.suppliers, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' },
  payment: { label: 'Payment', icon: Icons.payments, color: 'text-teal-500 bg-teal-500/10 border-teal-500/30' },
  stock_adjustment: { label: 'Stock Adjustment', icon: Icons.stockAdjustments, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  customer_return: { label: 'Customer Return', icon: Icons.returns, color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  supplier_return: { label: 'Supplier Return', icon: Icons.supplierReturns, color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
};

const ACTION_CONFIGS: Record<AuditAction, { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; color: string }> = {
  create: { label: 'Created', badgeVariant: 'outline', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  update: { label: 'Updated', badgeVariant: 'secondary', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  delete: { label: 'Deleted', badgeVariant: 'destructive', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  fulfill: { label: 'Fulfilled', badgeVariant: 'success', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  restock: { label: 'Restocked', badgeVariant: 'outline', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
  adjust_stock: { label: 'Stock Adjusted', badgeVariant: 'warning', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  credit_override: { label: 'Credit Override', badgeVariant: 'destructive', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
  payment_received: { label: 'Payment Received', badgeVariant: 'success', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30' },
};

function getEntityLink(type: AuditEntityType, id: string): string | null {
  switch (type) {
    case 'sales_order':
      return `/sales-orders/${id}`;
    case 'product':
      return `/products/${id}`;
    case 'customer':
      return `/customers/${id}`;
    case 'supplier':
      return `/suppliers/${id}`;
    case 'customer_return':
      return `/customer-returns/${id}`;
    case 'supplier_return':
      return `/supplier-returns/${id}`;
    case 'payment':
      return `/payments`;
    case 'stock_adjustment':
      return `/stock-adjustments`;
    default:
      return null;
  }
}

function formatChangeSummary(log: AuditLog): string {
  if (log.action === 'credit_override') {
    const meta = log.metadata || {};
    const limit = meta.credit_limit ? `₹${Number(meta.credit_limit).toLocaleString('en-IN')}` : '';
    const due = meta.projected_due ? `Proj: ₹${Number(meta.projected_due).toLocaleString('en-IN')}` : '';
    return `Manager credit override authorized ${limit ? `(${limit}` : ''}${due ? `, ${due})` : limit ? ')' : ''}`;
  }

  if (log.action === 'fulfill') {
    const meta = log.metadata || {};
    if (meta.items_count) {
      return `Fulfillment confirmed (${meta.items_count} items dispatch)`;
    }
    return 'Order delivered & inventory deducted';
  }

  if (log.action === 'adjust_stock') {
    const changes = log.changes || {};
    const meta = log.metadata || {};
    const qty = Number(meta.quantity);
    const delta = meta.quantity !== undefined && !isNaN(qty) ? `${qty > 0 ? '+' : ''}${qty}` : null;
    const reason = meta.reason ? `Reason: ${String(meta.reason)}` : '';
    if (delta) {
      return `Inventory altered (${delta} units). ${reason}`.trim();
    }
    return reason || 'Physical inventory reconciliation applied';
  }

  if (log.changes && Object.keys(log.changes).length > 0) {
    const fields = Object.keys(log.changes);
    if (fields.length === 1) {
      const field = fields[0];
      const change = log.changes[field];
      return `Modified ${field}: "${String(change.old ?? 'none')}" → "${String(change.new ?? 'none')}"`;
    }
    return `Updated ${fields.length} properties: ${fields.slice(0, 3).join(', ')}${fields.length > 3 ? '...' : ''}`;
  }

  if (log.metadata && Object.keys(log.metadata).length > 0) {
    const keys = Object.keys(log.metadata).filter(k => k !== 'credit_override');
    if (keys.length > 0) {
      return `Attributes: ${keys.map(k => `${k}: ${log.metadata![k]}`).join(', ')}`;
    }
  }

  return `Action performed on ${log.entity_type.replace('_', ' ')}`;
}

export default function SystemAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Inspect Modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSystemAuditLogs({
        limit: 300,
      });
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err?.message || 'Failed to load system audit trail.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  // Date preset handler
  const handleDatePreset = (preset: 'all' | 'today' | 'week' | 'month') => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      setStartDate(weekAgo.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const monthAgo = new Date();
      monthAgo.setDate(now.getDate() - 30);
      setStartDate(monthAgo.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedEntityType('all');
    setSelectedAction('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Entity type filter
      if (selectedEntityType !== 'all' && log.entity_type !== selectedEntityType) {
        return false;
      }

      // Action filter
      if (selectedAction !== 'all' && log.action !== selectedAction) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate < startDate) return false;
      }
      if (endDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate > endDate) return false;
      }

      // Text search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesActor = log.actor_name?.toLowerCase().includes(q) || log.actor_email?.toLowerCase().includes(q);
        const matchesEntityId = log.entity_id.toLowerCase().includes(q);
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesChanges = log.changes ? JSON.stringify(log.changes).toLowerCase().includes(q) : false;
        const matchesMeta = log.metadata ? JSON.stringify(log.metadata).toLowerCase().includes(q) : false;
        if (!matchesActor && !matchesEntityId && !matchesAction && !matchesChanges && !matchesMeta) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedEntityType, selectedAction, startDate, endDate, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const fulfillments = logs.filter((l) => l.action === 'fulfill').length;
    const stockAdjustments = logs.filter((l) => l.action === 'adjust_stock' || l.action === 'restock').length;
    const creditOverrides = logs.filter((l) => l.action === 'credit_override').length;
    const modifications = logs.filter((l) => l.action === 'update' || l.action === 'delete').length;

    return {
      total,
      fulfillments,
      stockAdjustments,
      creditOverrides,
      modifications,
    };
  }, [logs]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No audit logs available to export.');
      return;
    }

    const headers = [
      'Timestamp (UTC)',
      'Log ID',
      'Entity Type',
      'Entity ID',
      'Action',
      'Actor Name',
      'Actor Email',
      'Change Summary',
      'Changes (JSON)',
      'Metadata (JSON)',
    ];

    const rows = filteredLogs.map((log) => [
      `"${new Date(log.created_at).toISOString()}"`,
      `"${log.id}"`,
      `"${log.entity_type}"`,
      `"${log.entity_id}"`,
      `"${log.action}"`,
      `"${log.actor_name || 'System'}"`,
      `"${log.actor_email || ''}"`,
      `"${formatChangeSummary(log).replace(/"/g, '""')}"`,
      `"${JSON.stringify(log.changes || {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rds_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageContainer>
      <PageHeader
        title="System Audit Trail & Explorer"
        description="Comprehensive, immutable event logs recording order lifecycles, stock shifts, financial overrides, and entity changes."
        badge={
          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
            Immutable Audit v1.0
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="h-8 gap-1.5 text-xs"
            >
              <Icons.refresh className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="h-8 gap-1.5 text-xs shadow-xs"
            >
              <Icons.download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events Logged"
          value={stats.total.toLocaleString('en-IN')}
          icon={<Icons.timeline className="w-5 h-5 text-primary" />}
          description="Total audit entries captured"
        />

        <StatCard
          title="Fulfillments & Dispatches"
          value={stats.fulfillments.toLocaleString('en-IN')}
          icon={<Icons.delivery className="w-5 h-5 text-emerald-500" />}
          description="Warehouse & delivery dispatches"
        />

        <StatCard
          title="Stock Adjustments"
          value={stats.stockAdjustments.toLocaleString('en-IN')}
          icon={<Icons.stockAdjustments className="w-5 h-5 text-purple-500" />}
          description="Reconciliations & restocks"
        />

        <StatCard
          title="Credit Overrides & Alerts"
          value={stats.creditOverrides.toLocaleString('en-IN')}
          icon={<Icons.shieldAlert className="w-5 h-5 text-rose-500" />}
          description="Manager credit exceptions"
          trend={
            stats.creditOverrides > 0
              ? { value: `${stats.creditOverrides} Exceptions`, isPositive: false }
              : undefined
          }
        />
      </div>

      {/* Filter and Control Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Icons.search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search actor, entity ID, changes..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Entity Type Dropdown */}
            <div>
              <select
                value={selectedEntityType}
                onChange={(e) => {
                  setSelectedEntityType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="all">All Entity Types</option>
                <option value="sales_order">Sales Orders</option>
                <option value="product">Products / Catalog</option>
                <option value="customer">Customers</option>
                <option value="supplier">Suppliers</option>
                <option value="stock_adjustment">Stock Adjustments</option>
                <option value="payment">Payments</option>
                <option value="customer_return">Customer Returns</option>
                <option value="supplier_return">Supplier Returns</option>
              </select>
            </div>

            {/* Action Dropdown */}
            <div>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="all">All Actions</option>
                <option value="create">Created</option>
                <option value="update">Updated</option>
                <option value="delete">Deleted</option>
                <option value="fulfill">Fulfilled</option>
                <option value="adjust_stock">Stock Adjusted</option>
                <option value="restock">Restocked</option>
                <option value="credit_override">Credit Override</option>
                <option value="payment_received">Payment Received</option>
              </select>
            </div>

            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['all', 'today', 'week', 'month'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleDatePreset(preset)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap',
                    datePreset === preset
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {preset === 'all' ? 'All Time' : preset === 'week' ? '7 Days' : preset === 'month' ? '30 Days' : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Date range pickers & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground font-medium">Custom Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('all');
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded border border-border bg-background text-xs"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('all');
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded border border-border bg-background text-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                Showing <strong className="text-foreground">{filteredLogs.length}</strong> of{' '}
                <strong>{logs.length}</strong> entries
              </span>
              {(searchQuery || selectedEntityType !== 'all' || selectedAction !== 'all' || startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {loading ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <Icons.refresh className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Loading audit records...</p>
            <p className="text-xs text-muted-foreground mt-1">Connecting to immutable system event log...</p>
          </CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <Icons.search className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No audit logs found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {logs.length === 0
                ? 'No activities have been recorded in the audit logs table yet. As actions occur, they will populate here.'
                : 'Try adjusting your search terms or clearing your filters to view more records.'}
            </p>
            {(searchQuery || selectedEntityType !== 'all' || selectedAction !== 'all' || startDate || endDate) && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 text-xs">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Event Summary</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedLogs.map((log) => {
                  const entityConf = ENTITY_TYPE_LABELS[log.entity_type] || {
                    label: log.entity_type,
                    icon: Icons.inventory,
                    color: 'text-muted-foreground bg-muted',
                  };
                  const EntityIcon = entityConf.icon;
                  const actionConf = ACTION_CONFIGS[log.action] || {
                    label: log.action,
                    badgeVariant: 'outline' as const,
                    color: 'bg-muted text-muted-foreground',
                  };
                  const entityLink = getEntityLink(log.entity_type, log.entity_id);
                  const isCreditAlert = log.action === 'credit_override';

                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        isCreditAlert && 'bg-rose-500/5 hover:bg-rose-500/10'
                      )}
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                        <div>
                          {new Date(log.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70">
                          {new Date(log.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'p-1 rounded-md border text-[10px] flex items-center gap-1 font-medium',
                              entityConf.color
                            )}
                          >
                            <EntityIcon className="w-3 h-3" />
                            <span>{entityConf.label}</span>
                          </span>
                        </div>
                        <div className="mt-1">
                          {entityLink ? (
                            <Link
                              href={entityLink}
                              className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                              title="View entity details"
                            >
                              <span>{log.entity_id.substring(0, 8)}</span>
                              <Icons.external className="w-2.5 h-2.5 opacity-60" />
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {log.entity_id.substring(0, 8)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={actionConf.badgeVariant}
                          className={cn('text-[10px] font-semibold border', actionConf.color)}
                        >
                          {actionConf.label}
                        </Badge>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-xs">
                            {log.actor_name || 'System User'}
                          </span>
                          {log.actor_email && (
                            <span className="text-[10px] text-muted-foreground">{log.actor_email}</span>
                          )}
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-foreground font-medium line-clamp-2 max-w-md">
                          {formatChangeSummary(log)}
                        </p>
                      </td>

                      {/* Action View */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectLog(log)}
                          className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Icons.eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Page <strong className="text-foreground">{currentPage}</strong> of{' '}
                <strong className="text-foreground">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 text-xs px-2"
                >
                  <Icons.back className="w-3 h-3 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 text-xs px-2"
                >
                  Next <Icons.forward className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Inspect Log Diff Modal */}
      {inspectLog && (
        <Modal
          isOpen={Boolean(inspectLog)}
          onClose={() => setInspectLog(null)}
          title="Audit Log Entry Inspection"
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            {/* Header summary */}
            <div className="p-3 rounded-lg border border-border/60 bg-muted/40 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-semibold',
                      ACTION_CONFIGS[inspectLog.action]?.color || 'bg-muted text-muted-foreground'
                    )}
                  >
                    {ACTION_CONFIGS[inspectLog.action]?.label || inspectLog.action}
                  </Badge>
                  <span className="text-muted-foreground">on</span>
                  <Badge variant="outline" className="text-xs capitalize font-medium">
                    {inspectLog.entity_type.replace('_', ' ')}
                  </Badge>
                </div>

                <span className="font-mono text-muted-foreground text-[11px]">
                  {new Date(inspectLog.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Entity ID: </span>
                  <span className="font-mono font-medium text-foreground">{inspectLog.entity_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actor: </span>
                  <span className="font-medium text-foreground">
                    {inspectLog.actor_name || 'System User'}
                    {inspectLog.actor_email ? ` (${inspectLog.actor_email})` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Entity Navigation Link if available */}
            {getEntityLink(inspectLog.entity_type, inspectLog.entity_id) && (
              <div className="flex justify-end">
                <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                  <Link href={getEntityLink(inspectLog.entity_type, inspectLog.entity_id)!}>
                    <span>Open Entity Details</span>
                    <Icons.external className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Changed Properties Diff */}
            {inspectLog.changes && Object.keys(inspectLog.changes).length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                  Field Modifications
                </h4>
                <div className="border border-border/60 rounded-lg overflow-hidden divide-y divide-border/40">
                  {Object.entries(inspectLog.changes).map(([field, delta]) => (
                    <div key={field} className="p-3 bg-card space-y-1.5">
                      <span className="font-mono font-semibold text-primary">{field}</span>
                      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                        <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive">
                          <span className="text-[10px] text-muted-foreground block mb-0.5 uppercase tracking-wider font-sans font-bold">
                            Previous Value
                          </span>
                          <span className="break-all whitespace-pre-wrap">
                            {delta.old === null || delta.old === undefined
                              ? 'null'
                              : typeof delta.old === 'object'
                              ? JSON.stringify(delta.old, null, 2)
                              : String(delta.old)}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-success/10 border border-success/20 text-success">
                          <span className="text-[10px] text-muted-foreground block mb-0.5 uppercase tracking-wider font-sans font-bold">
                            New Value
                          </span>
                          <span className="break-all whitespace-pre-wrap">
                            {delta.new === null || delta.new === undefined
                              ? 'null'
                              : typeof delta.new === 'object'
                              ? JSON.stringify(delta.new, null, 2)
                              : String(delta.new)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Metadata Section */}
            {inspectLog.metadata && Object.keys(inspectLog.metadata).length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                  Contextual Metadata
                </h4>
                <div className="p-3 rounded-lg border border-border/60 bg-muted/30 font-mono text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(inspectLog.metadata).map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-0.5 border-b border-border/40 pb-1.5">
                        <span className="text-[10px] text-muted-foreground font-sans font-medium uppercase tracking-wider">
                          {key}
                        </span>
                        <span className="font-medium text-foreground break-all">
                          {typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Raw JSON inspection */}
            <details className="text-xs group border border-border/40 rounded-lg p-2 bg-muted/20">
              <summary className="font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                Raw Audit Entry JSON
              </summary>
              <pre className="mt-2 p-2 bg-black/80 text-emerald-400 rounded text-[11px] overflow-x-auto font-mono max-h-48 no-scrollbar">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </details>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
