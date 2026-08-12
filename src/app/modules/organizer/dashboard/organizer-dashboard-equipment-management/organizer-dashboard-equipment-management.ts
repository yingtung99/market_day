import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerEquipmentSummary } from '../../../../models/interface/organizer/OrganizerOperations';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { DashboardDataTable, DashboardTableAction, DashboardTableColumn } from '../../../shared/dashboard/dashboard-data-table/dashboard-data-table';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';

interface EquipmentActivityRow {
  id: number;
  activity: string;
  activityImage: string;
  activityTime: string;
  activityStatus: string;
  activityStatusClass?: string;
  registrationCount: string;
  baseEquipment: string;
  basePower: string;
  rentalEquipment: string;
  extraPower: string;
  vehicleRegistration: string;
  actions?: { key: string; label: string; variant?: 'primary' | 'outline' | 'danger' | 'success' | 'muted' }[];
}

@Component({
  selector: 'app-organizer-dashboard-equipment-management',
  imports: [FormsModule, RouterLink, DashboardDataTable, DashboardPagination, Dropdown, DateRangeSelector],
  templateUrl: './organizer-dashboard-equipment-management.html',
  styleUrl: './organizer-dashboard-equipment-management.scss',
})
/** 設備管理列表，依活動查詢租借設備、額外用電與車牌登記概況。 */
export class OrganizerDashboardEquipmentManagement implements OnInit {
  @ViewChild(DateRangeSelector) private dateRangeSelector?: DateRangeSelector;
  currentPage = 1;
  readonly pageSize = 6;
  totalItems = 0;
  keyword = '';
  selectedStatus = ActivityStatus.all;
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  displayRows: EquipmentActivityRow[] = [];

  readonly statusOptions = ActivityStatus.filterList;
  readonly columns: DashboardTableColumn[] = [
    { key: 'activity', label: '活動名稱', type: 'imageText', minWidth: '172px', truncate: true },
    { key: 'activityTime', label: '活動日期', minWidth: '148px', nowrap: true },
    { key: 'activityStatus', label: '活動狀態', type: 'status', align: 'center', minWidth: '88px' },
    { key: 'registrationCount', label: '報名攤數', align: 'center', minWidth: '72px', nowrap: true },
    { key: 'baseEquipment', label: '基本設備數', align: 'center', minWidth: '72px', nowrap: true },
    { key: 'basePower', label: '基本用電數', align: 'center', minWidth: '72px', nowrap: true },
    { key: 'rentalEquipment', label: '租借設備數', align: 'center', minWidth: '72px', nowrap: true },
    { key: 'extraPower', label: '額外用電數', align: 'center', minWidth: '72px', nowrap: true },
    { key: 'vehicleRegistration', label: '車牌登記數', align: 'center', minWidth: '72px', nowrap: true },
    { key: 'action', label: '', type: 'action', align: 'end', minWidth: '72px' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  /** 還原網址查詢條件並載入設備管理活動列表。 */
  ngOnInit(): void {
    this.currentPage = Math.max(1, Number(this.route.snapshot.queryParamMap.get('page')) || 1);
    this.keyword = this.route.snapshot.queryParamMap.get('keyword') ?? '';
    this.selectedStatus = this.route.snapshot.queryParamMap.get('status') ?? ActivityStatus.all;
    this.filterStartDate = this.route.snapshot.queryParamMap.get('startDate');
    this.filterEndDate = this.route.snapshot.queryParamMap.get('endDate');
    void this.loadRows();
  }

  selectStatus(status: string): void {
    this.selectedStatus = status || ActivityStatus.all;
    this.currentPage = 1;
    this.syncListQueryParams();
    void this.loadRows();
  }

  searchEquipmentActivities(): void {
    const range = this.dateRangeSelector?.getTimeRange();
    this.filterStartDate = range?.startDate ?? this.filterStartDate;
    this.filterEndDate = range?.endDate ?? this.filterEndDate;
    this.currentPage = 1;
    this.syncListQueryParams();
    void this.loadRows();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncListQueryParams();
    void this.loadRows();
  }

  onTableRowClick(row: Record<string, unknown>): void {
    this.onTableAction({ key: 'view', label: '查看', variant: 'outline', row });
  }

  onTableAction(action: DashboardTableAction): void {
    const row = action.row as unknown as EquipmentActivityRow;
    this.router.navigate(['/organizer/dash-board/equipment/detail', row.id], {
      queryParams: { returnPage: this.currentPage, returnStatus: this.selectedStatus === ActivityStatus.all ? null : this.selectedStatus },
    });
  }

  /** 依活動、狀態與日期條件查詢設備統計資料。 */
  private async loadRows(): Promise<void> {
    try {
      const response = await firstValueFrom(this.organizerApi.searchOrganizerEquipment({
        eventTitle: this.keyword.trim() || undefined,
        status: this.selectedStatus === ActivityStatus.all ? undefined : ActivityStatus.toApiStatus(this.selectedStatus) ?? this.selectedStatus,
        eventStartAt: this.filterStartDate,
        eventEndAt: this.filterEndDate,
        page: this.currentPage,
        pageSize: this.pageSize,
      }));
      this.totalItems = response.data.events.totalItems ?? response.data.totalCount ?? 0;
      this.displayRows = (response.data.events.items ?? []).map((item) => this.mapRow(item));
    } catch {
      this.totalItems = 0;
      this.displayRows = [];
    }
  }

  /** 將後端設備摘要轉成管理列表顯示模型。 */
  private mapRow(item: OrganizerEquipmentSummary): EquipmentActivityRow {
    const status = ActivityStatus.fromApiStatus(item.status ?? '');
    return {
      id: item.eventId,
      activity: item.eventTitle || '-',
      activityImage: item.coverImageUrl || 'assets/images/market/cards/market-card-01.png',
      activityTime: item.eventDate || '-',
      activityStatus: status,
      activityStatusClass: ActivityStatus.getClass(status),
      registrationCount: String(item.registeredStallCount ?? 0),
      baseEquipment: String(item.freeEquipmentRentalCount ?? 0),
      basePower: String(item.freePowerRentalCount ?? 0),
      rentalEquipment: String(item.paidEquipmentRentalCount ?? 0),
      extraPower: String(item.paidExtraPowerRentalCount ?? 0),
      vehicleRegistration: String(item.vehicleRegistrationCount ?? 0),
      actions: [{ key: 'view', label: '查看', variant: 'outline' }],
    };
  }

  private syncListQueryParams(): void {
    this.router.navigate([], { relativeTo: this.route, replaceUrl: true, queryParams: {
      page: this.currentPage,
      status: this.selectedStatus === ActivityStatus.all ? null : this.selectedStatus,
      keyword: this.keyword.trim() || null,
      startDate: this.filterStartDate || null,
      endDate: this.filterEndDate || null,
    }});
  }
}
