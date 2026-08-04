import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { MarketMapData } from '../../../../models/interface/shared/MarketMap';
import { MarketMap, DEFAULT_MARKET_MAP_DATA } from '../../../shared/market-map/market-map';

@Component({
  selector: 'app-organizer-dashboard-stall-map',
  imports: [RouterLink, MarketMap],
  templateUrl: './organizer-dashboard-stall-map.html',
  styleUrl: './organizer-dashboard-stall-map.scss',
})
/** 主辦方攤位地圖：依活動日期載入當日攤位與品牌配置。 */
export class OrganizerDashboardStallMap implements OnInit {
  eventId = 0;
  event = { name: '-', date: '-', time: '-', place: '-', total: 0, available: 0, selected: 0 };
  mapData: MarketMapData = DEFAULT_MARKET_MAP_DATA;
  dateOptions: string[] = [];
  selectedDate = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizerApi: OrganizerApiService,
  ) {}

  ngOnInit(): void {
    this.eventId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.eventId <= 0) return;

    const applyDate = this.route.snapshot.queryParamMap.get('applyDate')?.replaceAll('/', '-');
    void this.loadMap(applyDate || undefined);
  }

  selectDate(date: string): void {
    if (!date || date === this.selectedDate) return;
    void this.loadMap(date.replaceAll('/', '-'));
  }

  goBack(): void {
    if (this.route.snapshot.queryParamMap.get('returnTo') === 'registration') {
      const applicationId = Number(this.route.snapshot.queryParamMap.get('applicationId'));
      if (Number.isInteger(applicationId) && applicationId > 0) {
        this.router.navigate(['/organizer/dash-board/register/detail', applicationId], {
          queryParams: {
            returnPage: this.route.snapshot.queryParamMap.get('registrationReturnPage'),
            returnStatus: this.route.snapshot.queryParamMap.get('registrationReturnStatus'),
          },
        });
        return;
      }
    }

    this.router.navigate(['/organizer/dash-board/stall/detail', this.eventId], {
      queryParams: {
        returnPage: this.route.snapshot.queryParamMap.get('returnPage'),
        returnKeyword: this.route.snapshot.queryParamMap.get('returnKeyword'),
        returnStatus: this.route.snapshot.queryParamMap.get('returnStatus'),
      },
    });
  }

  private async loadMap(applyDate?: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.organizerApi.getOrganizerStallMap(this.eventId, {
          applyDate: applyDate || undefined,
        }),
      );
      const data = response.data;
      const start = new Date(data.event.startAt);
      const end = new Date(data.event.endAt);

      this.dateOptions = this.buildDateOptions(data.event.startAt, data.event.endAt);
      this.selectedDate = this.formatDateOption(
        data.event.currentApplyDate || applyDate || this.dateOptions[0] || '',
      );
      if (this.selectedDate && !this.dateOptions.includes(this.selectedDate)) {
        this.dateOptions = [this.selectedDate, ...this.dateOptions];
      }

      this.event = {
        name: data.event.eventTitle || '-',
        date: `${this.dateOnly(start)} - ${this.dateOnly(end)}`,
        time: `${this.timeOnly(start)} - ${this.timeOnly(end)}`,
        place: data.event.locationName || data.event.address || '-',
        total: data.event.totalStallCount ?? 0,
        available: data.event.availableStallCount ?? 0,
        selected: data.event.selectedStallCount ?? 0,
      };

      const apiStalls = new Map((data.stalls ?? []).flatMap((zone) =>
        zone.stalls.map((stall) => [
          stall.stallNo.toUpperCase(),
          { stall, zone: zone.zoneName },
        ] as const),
      ));

      this.mapData = {
        ...DEFAULT_MARKET_MAP_DATA,
        name: data.event.eventTitle,
        booths: DEFAULT_MARKET_MAP_DATA.booths
          .filter((booth) =>
            booth.id === 'service-booth' || apiStalls.has(booth.code.toUpperCase()),
          )
          .map((booth) => {
            const api = apiStalls.get(booth.code.toUpperCase());
            if (!api) return booth;

            const vendor = api.stall.selectedVendor;
            const status = api.stall.status.trim().toUpperCase();
            const selected = api.stall.selectedApplicationId != null
              || ['SELECTED', 'OCCUPIED', 'ASSIGNED', 'SOLD'].includes(status)
              || api.stall.status.includes('\u5df2\u9078\u64c7')
              || api.stall.status.includes('\u7cfb\u7d71\u5206\u914d');
            return {
              ...booth,
              zone: api.zone,
              status: selected
                ? 'selected' as const
                : status === 'AVAILABLE' || api.stall.status.includes('\u53ef\u9078\u64c7')
                  ? 'available' as const
                  : 'occupied' as const,
              size: api.stall.length && api.stall.width
                ? `${api.stall.length}m × ${api.stall.width}m`
                : booth.size,
              applicationId: api.stall.selectedApplicationId ?? undefined,
              vendorOwnerName: vendor?.ownerName || undefined,
              selectedAt: vendor?.selectedAt || undefined,
              brand: vendor?.name
                ? {
                    id: String(vendor.brandId),
                    name: vendor.name,
                    category: vendor.category?.name || '-',
                    summary: '',
                    logo: '',
                  }
                : undefined,
            };
          }),
      };
    } catch {
      this.mapData = { ...DEFAULT_MARKET_MAP_DATA, booths: [] };
    }
  }

  private buildDateOptions(startAt: string, endAt: string): string[] {
    const startDate = this.apiDateOnly(startAt);
    const endDate = this.apiDateOnly(endAt);
    if (!startDate || !endDate) return [];

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

    const dates: string[] = [];
    for (
      const current = new Date(start);
      current <= end;
      current.setUTCDate(current.getUTCDate() + 1)
    ) {
      dates.push(this.formatDateOption(current.toISOString().slice(0, 10)));
    }
    return dates;
  }

  private apiDateOnly(value: string): string {
    return value.replaceAll('/', '-').match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
  }

  private formatDateOption(value: string): string {
    const date = this.apiDateOnly(value);
    return date ? date.replaceAll('-', '/') : '';
  }

  private dateOnly(value: Date): string {
    return Number.isNaN(value.getTime())
      ? '-'
      : value.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  private timeOnly(value: Date): string {
    return Number.isNaN(value.getTime())
      ? '-'
      : value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
