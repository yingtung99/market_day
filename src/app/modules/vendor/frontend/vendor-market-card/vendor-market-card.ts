import { Component,Input } from '@angular/core';
import { MarketCardItem } from '../../../../models/interface/shared/MarketCardItem';
import { MarketStatus } from '../../../../models/status/MarketStatus';
import { BrandType } from '../../../../models/type/BrandType ';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-vendor-market-card',
  imports: [RouterLink],
  templateUrl: './vendor-market-card.html',
  styleUrl: './vendor-market-card.scss',
})
export class VendorMarketCard {
  keyword = '';
  selectedCity = '';
  selectedStatus = '';
  currentPage = 1;
  pageSize = 6;
  
@Input({ required: true }) market!: MarketCardItem;

  getStatusClass(status: String): string {
    return MarketStatus.getClass(status as string);
  }

  getDeadlineText(startDate?: string, endDate?: string): string {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);

    if (!end) return '報名時間未定';

    const now = new Date();

    if (start && now < start) return '報名尚未開始';
    if (now >= end) return '報名已截止';

    const today = new Date(now);
    const deadline = new Date(end);
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const diffDays = Math.round((deadline.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return '今天報名截止';

    return `${diffDays} 天後報名截止`;
  }

  private parseDate(value?: string): Date | null {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
