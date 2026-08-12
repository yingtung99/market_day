import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerStallEventSummary } from '../../../../models/interface/organizer/OrganizerOperations';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { DashboardDataTable, DashboardTableAction, DashboardTableColumn } from '../../../shared/dashboard/dashboard-data-table/dashboard-data-table';
import { DashboardPagination } from '../../../shared/dashboard/dashboard-pagination/dashboard-pagination';
import { DateRangeSelector } from '../../../shared/date-range-selector/date-range-selector';
import { Dropdown } from '../../../shared/dropdown/dropdown';

interface StallEvent {
  id: number;
  name: string;
  image: string;
  startDate: string;
  endDate: string;
  location: string;
  boothCount: number;
  availableBoothCount: number;
  selectedBoothCount: number;
  status: string;
  statusClass: string;
}

@Component({
  selector: 'app-organizer-dashboard-stall-management',
  imports: [FormsModule, DashboardDataTable, DashboardPagination, DateRangeSelector, Dropdown],
  templateUrl: './organizer-dashboard-stall-management.html',
  styleUrl: './organizer-dashboard-stall-management.scss',
})
/** 攤位管理列表，依活動與狀態查詢攤位使用概況。 */
export class OrganizerDashboardStallManagement implements OnInit {
  @ViewChild(DateRangeSelector) private dateRangeSelector?: DateRangeSelector;
  keyword = '';
  selectedStatus = ActivityStatus.all;
  startDate = '';
  endDate = '';
  currentPage = 1;
  readonly pageSize = 6;
  totalItems = 0;
  events: StallEvent[] = [];

  readonly columns: DashboardTableColumn[] = [
    { key: 'name', label: '活動名稱', type: 'imageText', width: '18%', truncate: true },
    { key: 'date', label: '活動日期', nowrap: true, width: '16%' },
    { key: 'location', label: '活動地點', width: '18%' },
    { key: 'status', label: '活動狀態', type: 'status', align: 'center', width: '11%' },
    { key: 'boothCount', label: '攤位總數', align: 'center', nowrap: true, width: '9%' },
    { key: 'selectedBoothCount', label: '已選攤位數', align: 'center', nowrap: true, width: '9%' },
    { key: 'availableBoothCount', label: '可選攤位數', align: 'center', nowrap: true, width: '9%' },
    { key: 'action', label: '', type: 'action', align: 'center', width: '10%' },
  ];
  readonly statusOptions = ActivityStatus.filterList;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  /** 從網址還原查詢條件並載入活動攤位概況。 */
  ngOnInit(): void {
    this.keyword = this.route.snapshot.queryParamMap.get('keyword') ?? '';
    this.selectedStatus = this.route.snapshot.queryParamMap.get('status') ?? ActivityStatus.all;
    this.startDate = this.route.snapshot.queryParamMap.get('startDate') ?? '';
    this.endDate = this.route.snapshot.queryParamMap.get('endDate') ?? '';
    this.currentPage = Math.max(1, Number(this.route.snapshot.queryParamMap.get('page')) || 1);
    void this.loadEvents();
  }

  get displayRows(): Record<string, unknown>[] {
    return this.events.map((event) => ({
      ...event,
      nameImage: event.image,
      date: [event.startDate, event.endDate].filter(Boolean).join(' - ') || '-',
      statusClass: event.statusClass,
      actions: [{ key: 'view', label: '查看', variant: 'outline' }],
    }));
  }

  search(): void {
    const range = this.dateRangeSelector?.getTimeRange();
    this.startDate = range?.startDate ?? this.startDate;
    this.endDate = range?.endDate ?? this.endDate;
    this.currentPage = 1;
    this.syncQuery();
    void this.loadEvents();
  }

  selectStatus(status: string): void {
    this.selectedStatus = status || ActivityStatus.all;
    this.search();
  }

  onTableRowClick(row: Record<string, unknown>): void {
    this.onTableAction({ key: 'view', label: '查看', variant: 'outline', row });
  }

  onTableAction(action: DashboardTableAction): void {
    this.viewDetail(action.row as unknown as StallEvent);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncQuery();
    void this.loadEvents();
  }

  viewDetail(event: StallEvent): void {
    this.router.navigate(['/organizer/dash-board/stall/detail', event.id], {
      queryParams: { returnPage: this.currentPage, returnKeyword: this.keyword || null, returnStatus: this.selectedStatus === ActivityStatus.all ? null : this.selectedStatus },
    });
  }

  /** 查詢活動攤位數量與選位進度，供主辦方選擇要管理的活動。 */
  private async loadEvents(): Promise<void> {
    try {
      const response = await firstValueFrom(this.organizerApi.searchOrganizerStalls({
        eventTitle: this.keyword.trim() || undefined,
        status: this.selectedStatus === ActivityStatus.all ? undefined : ActivityStatus.toApiStatus(this.selectedStatus) ?? this.selectedStatus,
        eventStartAt: this.startDate || null,
        eventEndAt: this.endDate || null,
        page: this.currentPage,
        pageSize: this.pageSize,
      }));
      this.totalItems = response.data.events.totalItems ?? response.data.totalCount ?? 0;
      this.events = (response.data.events.items ?? []).map((item) => this.mapEvent(item));
    } catch {
      this.totalItems = 0;
      this.events = [];
    }
  }

  private mapEvent(item: OrganizerStallEventSummary): StallEvent {
    const [startDate = '', endDate = ''] = (item.eventDate ?? '').split(' - ');
    const status = ActivityStatus.fromApiStatus(item.status ?? '');
    return {
      id: item.eventId,
      name: item.eventTitle || '-',
      image: item.coverImageUrl || 'assets/images/market/cards/market-card-01.png',
      startDate,
      endDate,
      location: item.address || '-',
      boothCount: item.totalStallCount ?? 0,
      availableBoothCount: item.availableStallCount ?? 0,
      selectedBoothCount: item.selectedStallCount ?? 0,
      status,
      statusClass: ActivityStatus.getClass(status),
    };
  }

  private syncQuery(): void {
    this.router.navigate([], { relativeTo: this.route, replaceUrl: true, queryParams: {
      page: this.currentPage,
      keyword: this.keyword || null,
      status: this.selectedStatus === ActivityStatus.all ? null : this.selectedStatus,
      startDate: this.startDate || null,
      endDate: this.endDate || null,
    }});
  }
}
