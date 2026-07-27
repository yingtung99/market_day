import { Component, ElementRef, OnDestroy, OnInit, Signal, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Legend,
  LinearScale,
  Plugin,
  ScriptableContext,
  Tooltip,
  TooltipModel,
} from 'chart.js';
import type { ActiveElement, ChartEvent, TooltipItem } from 'chart.js';
import { OrganizerDashboardNotification } from '../organizer-dashboard-notification/organizer-dashboard-notification';
import { DashboardHomeTodoCard } from '../../../shared/dashboard/dashboard-home-todo-card/dashboard-home-todo-card';
import { DashboardNotification } from '../../../shared/dashboard/dashboard-notification/dashboard-notification';
import { TodoItem } from '../../../../models/interface/organizer/OrganizerDashboardHomeTodo';
import { OrganizerAccessService } from '../../../../core/services/organizer-access.service';
import { OrganizerDashboardSetupGuide } from '../organizer-dashboard-setup-guide/organizer-dashboard-setup-guide';
import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { isApiSuccessStatus } from '../../../../models/interface/shared/ApiResult';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketDayUser } from '../../../../models/interface/shared/Auth';
import { ApplicationStatus } from '../../../../models/status/ApplicationStatus';
import { PaymentStatus } from '../../../../models/status/PaymentStatus';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';

interface ActivityRegistrationOverview {
  eventId: number;
  eventTitle: string;
  capacity: number;
  registeredCount: number;
  paidCount: number;
  selectedCount: number;
}

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

@Component({
  selector: 'app-organizer-dashboard-home',
  imports: [DashboardHomeTodoCard, DashboardNotification, RouterLink, OrganizerDashboardSetupGuide],
  templateUrl: './organizer-dashboard-home.html',
  styleUrl: './organizer-dashboard-home.scss',
})
/** 主辦方首頁，彙整待辦統計、活動報名概況、使用者名稱與最新通知。 */
export class OrganizerDashboardHome extends OrganizerDashboardNotification implements OnInit, OnDestroy {
  @ViewChild('registrationChart')
  private set registrationChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (!ref) return;

    this.registrationCanvas = ref;

    this.removeRegistrationTooltip();
    this.registrationChart?.destroy();
    this.registrationChart = new Chart(ref.nativeElement, this.createRegistrationChartConfig());
  }

  private registrationChart?: Chart<'bar'>;
  private registrationCanvas?: ElementRef<HTMLCanvasElement>;
  readonly needsProfile: Signal<boolean | null>;
  readonly setupCompleted: Signal<boolean>;
  readonly newebPayVerificationStatus;
  displayName = '主辦方';

  constructor(
    private readonly router: Router,
    private readonly organizerAccess: OrganizerAccessService,
    private readonly organizerApi: OrganizerApiService,
    private readonly authService: AuthService,
  ) {
    super();
    this.needsProfile = this.organizerAccess.needsProfile;
    this.setupCompleted = this.organizerAccess.setupCompleted;
    this.newebPayVerificationStatus = this.organizerAccess.newebPayVerificationStatus;
  }

  /** 初始化主辦方資料，並載入首頁各區塊所需的 API 資料。 */
  override ngOnInit(): void {
    this.loadDisplayName();
    void this.initializeDashboard();
  }

  /** 完成首次設定才載入一般首頁資料，避免鎖定期間呼叫尚不可用的管理 API。 */
  private async initializeDashboard(): Promise<void> {
    await this.organizerAccess.initialize();
    if (!this.organizerAccess.setupCompleted()) return;

    this.loadNotifications(3);
    this.loadDashboardData();
  }

  /** 主辦方後台首頁待辦展示資料，由報名管理 API 的 taskSummary 更新。 */
  todoItems: TodoItem[] = [
    {
      icon: 'bi-clipboard-heart',
      count: 0,
      unit: '筆',
      label: '待審核報名',
      path: '/organizer/dash-board/register',
      queryParams: { status: ApplicationStatus.pendingReview },
      iconColor: 'orange',
    },
    {
      icon: 'bi-wallet2',
      count: 0,
      unit: '筆',
      label: '退款待確認',
      path: '/organizer/dash-board/collection',
      queryParams: { status: PaymentStatus.refundRequested },
      iconColor: 'red',
    },
    {
      icon: 'bi-shop-window',
      count: 0,
      unit: '位',
      label: '待完成選位',
      path: '/organizer/dash-board/register',
      queryParams: { status: ApplicationStatus.pendingSelection },
      iconColor: 'blue',
    },
    {
      icon: 'bi-calendar-check',
      count: 0,
      unit: '場',
      label: '待發布',
      path: '/organizer/dash-board/activity',
      queryParams: { status: ActivityStatus.readyToPublish },
      iconColor: 'purple',
    },
  ];

  /** 首頁圖表展示資料；串接 API 後由首頁統計端點取代。 */
  activityRegistrationOverview: ActivityRegistrationOverview[] = [];

  /** 先顯示本地登入資料，再以伺服器的最新名稱覆蓋。 */
  private loadDisplayName(): void {
    this.displayName = this.resolveDisplayName(this.authService.getUser('organizer'));

    this.authService.getAuthMe({ skipLoading: true }).subscribe({
      next: (response) => {
        const user = response.data?.user;
        if (!isApiSuccessStatus(response.statusCode) || user?.role !== 'ORGANIZER') return;

        this.authService.saveUser('organizer', user);
        this.displayName = this.resolveDisplayName(user);
      },
      error: () => {
        // 保留登入時已儲存的名稱，避免個人資料 API 暫時失敗影響首頁顯示。
      },
    });
  }

  private resolveDisplayName(user: MarketDayUser | null): string {
    const name = user?.name?.trim();
    if (name) return name;

    return user?.email?.split('@')[0]?.trim() || '主辦方';
  }

  /** 載入待辦數量與活動報名概況，成功後同步更新圖表。 */
  private loadDashboardData(): void {
    this.organizerApi
      .searchOrganizerApplications({ page: 1, pageSize: 1 })
      .subscribe((applications) => {
        if (!isApiSuccessStatus(applications.statusCode) || !applications.data?.taskSummary) {
          return;
        }

        const summary = applications.data.taskSummary;
        const countByLabel: Record<string, number> = {
          待審核報名: summary.pendingReviewCount,
          退款待確認: summary.pendingRefundConfirmationCount,
          待完成選位: summary.pendingStallSelectionCount,
          待發布: summary.pendingPublishCount,
        };
        this.todoItems = this.todoItems.map((item) => ({
          ...item,
          count: countByLabel[item.label] ?? item.count,
        }));
      });

    this.organizerApi.searchOrganizerEvents({
      sort: 'UPCOMING_FIRST',
      page: 1,
      pageSize: 3,
      registrationOverview: true,
    }).subscribe((events) => {
        if (!isApiSuccessStatus(events.statusCode) || !events.data) return;
        this.activityRegistrationOverview = events.data.events.items.map((event) => ({
          eventId: event.eventId,
          eventTitle: event.eventTitle ?? '',
          capacity: event.capacity ?? 0,
          registeredCount: event.registeredCount,
          paidCount: event.paidCount,
          selectedCount: event.selectedCount,
        }));
        if (this.registrationCanvas) {
          this.removeRegistrationTooltip();
          this.registrationChart?.destroy();
          this.registrationChart = new Chart(
            this.registrationCanvas.nativeElement,
            this.createRegistrationChartConfig(),
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.removeRegistrationTooltip();
    this.registrationChart?.destroy();
  }

  /** 建立報名概況的堆疊橫條圖設定與互動行為。 */
  private createRegistrationChartConfig(): ChartConfiguration<'bar'> {
    const rows = this.activityRegistrationOverview;
    const colors = {
      selected: this.getCssColor('--chart-selected', '#dea064'),
      selectedHover: this.getCssColor('--chart-selected-hover', '#ad5f22'),
      paidPending: this.getCssColor('--chart-paid-pending', '#ecb77a'),
      paidPendingHover: this.getCssColor('--chart-paid-pending-hover', '#cf7f31'),
      unpaid: this.getCssColor('--chart-unpaid', '#f4d09a'),
      unpaidHover: this.getCssColor('--chart-unpaid-hover', '#e9aa55'),
      remaining: this.getCssColor('--chart-remaining', '#f3f0ea'),
      remainingHover: this.getCssColor('--chart-remaining-hover', '#e2d8c8'),
    };
    const stackRadius = (context: ScriptableContext<'bar'>) =>
      this.getStackBorderRadius(context.datasetIndex, context.dataIndex);
    const totalLabelPlugin: Plugin<'bar'> = {
      id: 'activityRegistrationTotalLabel',
      afterDatasetsDraw: (chart: Chart<'bar'>) => {
        const xScale = chart.scales['x'];
        const yScale = chart.scales['y'];
        const context = chart.ctx;

        context.save();
        context.font = '600 11px system-ui, sans-serif';
        context.fillStyle = '#5f5a54';

        rows.forEach((row, index) => {
          const x = xScale.getPixelForValue(row.capacity);
          const y = yScale.getPixelForValue(index);
          context.fillText(`${row.registeredCount} / ${row.capacity}`, x + 8, y + 4);
        });

        context.restore();
      },
    };

    return {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.eventTitle),
        datasets: [
          {
            label: '已選位',
            data: rows.map((row) => row.selectedCount),
            backgroundColor: colors.selected,
            hoverBackgroundColor: colors.selectedHover,
            borderRadius: stackRadius,
            borderSkipped: false,
            barPercentage: 0.62,
          },
          {
            label: '已付款未選位',
            data: rows.map((row) => Math.max(row.paidCount - row.selectedCount, 0)),
            backgroundColor: colors.paidPending,
            hoverBackgroundColor: colors.paidPendingHover,
            borderRadius: stackRadius,
            borderSkipped: false,
            barPercentage: 0.62,
          },
          {
            label: '已報名未付款',
            data: rows.map((row) => Math.max(row.registeredCount - row.paidCount, 0)),
            backgroundColor: colors.unpaid,
            hoverBackgroundColor: colors.unpaidHover,
            borderRadius: stackRadius,
            borderSkipped: false,
            barPercentage: 0.62,
          },
          {
            label: '剩餘名額',
            data: rows.map((row) => Math.max(row.capacity - row.registeredCount, 0)),
            backgroundColor: colors.remaining,
            hoverBackgroundColor: colors.remainingHover,
            borderColor: colors.remainingHover,
            borderWidth: 1,
            borderRadius: stackRadius,
            borderSkipped: false,
            barPercentage: 0.62,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        interaction: { mode: 'nearest', axis: 'y', intersect: true },
        onHover: (event: ChartEvent, elements: ActiveElement[]) => {
          const target = event.native?.target as HTMLElement | null;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          const selected = elements[0];
          if (!selected) return;
          this.navigateFromChart(selected.datasetIndex, selected.index);
        },
        plugins: {
          legend: {
            position: 'bottom',
            align: 'start',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 7,
              boxHeight: 7,
              padding: 14,
              color: '#5f5a54',
              font: { size: 11, weight: 600 },
            },
          },
          tooltip: {
            enabled: false,
            external: ({ chart, tooltip }) => this.renderRegistrationTooltip(chart, tooltip, rows),
          },
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            // Reserve space at the end of each bar so the external tooltip can
            // remain on the right while its caret still points at the hovered item.
            suggestedMax: Math.max(1, ...rows.map((row) => row.capacity)) * 1.25,
            grid: { color: '#ece9e4' },
            border: { display: false },
            ticks: { display: false },
          },
          y: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#35312d', font: { size: 14, weight: 700 }, padding: 12 },
          },
        },
      },
      plugins: [totalLabelPlugin],
    };
  }

  private navigateFromChart(datasetIndex: number, activityIndex: number): void {
    const activity = this.activityRegistrationOverview[activityIndex];
    if (!activity) return;

    const destinations = [
      { path: '/organizer/dash-board/stall', queryParams: { activity: activity.eventTitle } },
      { path: '/organizer/dash-board/stall', queryParams: { activity: activity.eventTitle } },
      { path: '/organizer/dash-board/collection', queryParams: { keyword: activity.eventTitle } },
      { path: '/organizer/dash-board/activity', queryParams: { keyword: activity.eventTitle } },
    ];
    const destination = destinations[datasetIndex];
    if (destination) void this.router.navigate([destination.path], { queryParams: destination.queryParams });
  }

  private renderRegistrationTooltip(
    chart: Chart,
    tooltip: TooltipModel<'bar'>,
    rows: ActivityRegistrationOverview[],
  ): void {
    const chartContainer = chart.canvas.parentElement;
    if (!chartContainer) return;
    const tooltipHost = chart.canvas.closest<HTMLElement>('.registration-overview-card') ?? chartContainer;

    let tooltipElement = tooltipHost.querySelector<HTMLElement>('.registration-chart-tooltip');
    if (!tooltipElement) {
      tooltipElement = document.createElement('div');
      tooltipElement.className = 'registration-chart-tooltip';
      tooltipHost.appendChild(tooltipElement);
    }

    if (tooltip.opacity === 0 || !tooltip.dataPoints.length) {
      tooltipElement.style.opacity = '0';
      return;
    }

    const selectedPoint = tooltip.dataPoints[0];
    const row = rows[selectedPoint.dataIndex];
    if (!row) return;

    const title = document.createElement('strong');
    title.textContent = row.eventTitle;

    const selectedSummary = document.createElement('div');
    selectedSummary.className = 'registration-chart-tooltip-selected';
    const colorSwatch = document.createElement('span');
    colorSwatch.className = 'registration-chart-tooltip-swatch';
    colorSwatch.style.backgroundColor = String(selectedPoint.element.options['backgroundColor']);
    const selectedLabel = document.createElement('span');
    selectedLabel.textContent = `${selectedPoint.dataset.label}：${selectedPoint.formattedValue} 人`;
    selectedSummary.append(colorSwatch, selectedLabel);

    const detailList = document.createElement('div');
    detailList.className = 'registration-chart-tooltip-details';
    [
      `活動名額：${row.capacity} 人`,
      `報名人數：${row.registeredCount} 人`,
      `已付款：${row.paidCount} 人`,
      `已選位：${row.selectedCount} 人`,
      `尚未付款：${Math.max(row.registeredCount - row.paidCount, 0)} 人`,
      `尚未選位：${Math.max(row.paidCount - row.selectedCount, 0)} 人`,
      `剩餘名額：${Math.max(row.capacity - row.registeredCount, 0)} 人`,
    ].forEach((detail) => {
      const line = document.createElement('span');
      line.textContent = detail;
      detailList.appendChild(line);
    });
    tooltipElement.replaceChildren(title, selectedSummary, detailList);
    tooltipElement.style.opacity = '1';

    const canvasRect = chart.canvas.getBoundingClientRect();
    const hostRect = tooltipHost.getBoundingClientRect();
    const pointX = canvasRect.left - hostRect.left + tooltip.caretX;
    const pointY = canvasRect.top - hostRect.top + tooltip.caretY;
    const tooltipWidth = tooltipElement.offsetWidth;
    const tooltipHeight = tooltipElement.offsetHeight;
    const maxTop = Math.max(8, tooltipHost.clientHeight - tooltipHeight - 8);
    const top = Math.min(Math.max(pointY - tooltipHeight / 2, 8), maxTop);
    const caretTop = Math.min(Math.max(pointY - top, 12), tooltipHeight - 12);

    tooltipElement.style.left = `${Math.max(
      8,
      Math.min(pointX + 9, tooltipHost.clientWidth - tooltipWidth - 8),
    )}px`;
    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.setProperty('--tooltip-caret-top', `${caretTop}px`);
  }

  private removeRegistrationTooltip(): void {
    this.registrationChart?.canvas.closest('.registration-overview-card')
      ?.querySelector('.registration-chart-tooltip')
      ?.remove();
  }

  private getCssColor(variableName: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback;
  }

  private getStackBorderRadius(datasetIndex: number, activityIndex: number) {
    const row = this.activityRegistrationOverview[activityIndex];
    const segmentValues = [
      row.selectedCount,
      Math.max(row.paidCount - row.selectedCount, 0),
      Math.max(row.registeredCount - row.paidCount, 0),
      Math.max(row.capacity - row.registeredCount, 0),
    ];
    const visibleIndexes = segmentValues
      .map((value, index) => (value > 0 ? index : -1))
      .filter((index) => index >= 0);
    const firstIndex = visibleIndexes[0];
    const lastIndex = visibleIndexes[visibleIndexes.length - 1];
    const radius = 6;

    return {
      topLeft: datasetIndex === firstIndex ? radius : 0,
      bottomLeft: datasetIndex === firstIndex ? radius : 0,
      topRight: datasetIndex === lastIndex ? radius : 0,
      bottomRight: datasetIndex === lastIndex ? radius : 0,
    };
  }
}
