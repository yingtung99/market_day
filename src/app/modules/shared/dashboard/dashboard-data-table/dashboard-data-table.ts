import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { formatDisplayDateText } from '../../../../core/utils/date-display.util';

export interface DashboardTableColumn {
  key: string;
  label: string;
  type?: 'text' | 'imageText' | 'status' | 'progress' | 'multiValue' | 'action';
  align?: 'start' | 'center' | 'end';
  width?: string;
  minWidth?: string;
  nowrap?: boolean;
  /** 超出欄寬時顯示省略號，並以原生提示顯示完整內容。 */
  truncate?: boolean;
  actionMinWidth?: string;
  valueKeys?: string[];
  valueLabels?: string[];
}

export interface DashboardTableAction {
  key?: string;
  label: string;
  variant?: 'primary' | 'outline' | 'danger' | 'success' | 'muted';
  disabled?: boolean;
  hint?: string;
  row: Record<string, unknown>;
}

export interface DashboardTableRowAction {
  key?: string;
  label: string;
  variant?: DashboardTableAction['variant'];
  disabled?: boolean;
  hint?: string;
}

@Component({
  selector: 'app-dashboard-data-table',
  imports: [],
  templateUrl: './dashboard-data-table.html',
  styleUrl: './dashboard-data-table.scss',
})
export class DashboardDataTable {
  @Input() columns: DashboardTableColumn[] = [];
  @Input() rows: Record<string, any>[] = [];
  @Input() tableMinWidth = '960px';
  @Input() minimumRows = 0;
  @Input() emptyText = '目前沒有資料';
  @Input() emptyHint = '';
  @Input() rowClickable = false;

  @Output() actionClick = new EventEmitter<DashboardTableAction>();
  @Output() rowClick = new EventEmitter<Record<string, unknown>>();

  get fillerRows(): number[] {
    return Array.from({ length: Math.max(0, this.minimumRows - this.rows.length) }, (_, index) => index);
  }

  getStatusClass(value: string): string {
    return ActivityStatus.classMap[value] ?? ApplicationStatus.getClass(value);
  }

  getDisplayValue(row: Record<string, any>, key: string): unknown {
    const value = row[key];
    const displayValue = value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
      ? '-'
      : value;
    return formatDisplayDateText(displayValue);
  }

  getProgressCurrent(column: DashboardTableColumn, row: Record<string, any>): number {
    return Number(row[`${column.key}Current`]) || 0;
  }

  hasProgress(column: DashboardTableColumn, row: Record<string, any>): boolean {
    const displayValue = row[column.key];
    const hasDisplayValue = displayValue !== null
      && displayValue !== undefined
      && String(displayValue).trim() !== ''
      && String(displayValue).trim() !== '-';

    return hasDisplayValue && this.getProgressTotal(column, row) > 0;
  }

  getProgressTotal(column: DashboardTableColumn, row: Record<string, any>): number {
    return Number(row[`${column.key}Total`]) || 0;
  }

  getProgressPercent(column: DashboardTableColumn, row: Record<string, any>): number {
    const total = this.getProgressTotal(column, row);
    if (total <= 0) return 0;
    return Math.min(100, Math.round(this.getProgressCurrent(column, row) / total * 100));
  }

  getRowActions(column: DashboardTableColumn, row: Record<string, any>): DashboardTableRowAction[] {
    const actions = row[`${column.key}Actions`] ?? row['actions'];

    if (Array.isArray(actions) && actions.length > 0) {
      return actions;
    }

    return [
      {
        label: String(row[`${column.key}Label`] ?? '查看'),
        variant: (row[`${column.key}Variant`] as DashboardTableAction['variant']) ?? 'outline',
      },
    ];
  }

  emitRowAction(row: Record<string, unknown>, action: DashboardTableRowAction): void {
    this.actionClick.emit({
      key: action.key,
      label: action.label,
      variant: action.variant ?? 'outline',
      disabled: action.disabled,
      hint: action.hint,
      row,
    });
  }

  emitRowClick(row: Record<string, unknown>, event: Event): void {
    if (!this.rowClickable || this.isInteractiveTarget(event)) return;
    this.rowClick.emit(row);
  }

  emitAction(column: DashboardTableColumn, row: Record<string, unknown>): void {
    this.actionClick.emit({
      label: String(row[`${column.key}Label`] ?? '查看'),
      variant: (row[`${column.key}Variant`] as DashboardTableAction['variant']) ?? 'outline',
      row,
    });
  }

  private isInteractiveTarget(event: Event): boolean {
    if (!(event.target instanceof Element)) return false;
    const interactiveElement = event.target.closest('button, a, input, select, textarea, [role="button"], [role="link"]');
    return interactiveElement !== null && interactiveElement !== event.currentTarget;
  }
}
