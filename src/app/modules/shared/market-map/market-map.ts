import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Dropdown } from '../dropdown/dropdown';
import {
  MarketBoothStatus,
  MarketMapBooth,
  MarketMapData,
  MarketMapMode,
} from '../../../models/interface/shared/MarketMap';

type PublicMapTab = 'detail' | 'directory';
type Point = [number, number];

const boothSize = 32;
const mapPaddingX = 28;
const mapPaddingTop = 10;
const mapPaddingBottom = 0;

const boothCoordinates: Record<string, Point[]> = {
  A: [
    [412, 230], [450, 230], [488, 230], [526, 230], [564, 230], [602, 230], [640, 230],
    [678, 230], [716, 230], [754, 230], [792, 230], [830, 230], [868, 230], [906, 230],
    [412, 270], [450, 270], [488, 270], [526, 270], [564, 270], [602, 270], [640, 270],
    [678, 270], [716, 270], [754, 270], [792, 270], [830, 270], [868, 270], [906, 270],
  ],
  B: [
    [50, 232], [88, 232], [126, 232],
    [50, 272], [88, 272], [126, 272],
    [246, 232], [284, 232], [322, 232],
    [222, 272], [260, 272], [298, 272], [336, 272],
  ],
  C: [
    [368, 316], [368, 354], [368, 392], [368, 430], [368, 468], [368, 506],
    [174, 316],
    [174, 354], [136, 392],
  ],
};

const createPosition = (
  x: number,
  y: number
): Pick<MarketMapBooth, 'x' | 'y' | 'width' | 'height' | 'shape' | 'labelX' | 'labelY'> => ({
  x,
  y,
  width: boothSize,
  height: boothSize,
  shape: 'rect',
  labelX: x + boothSize / 2,
  labelY: y + boothSize / 2 + 4,
});

const createBooths = (): MarketMapBooth[] => {
  const zoneCounts = { A: 28, B: 13, C: 9 };
  const booths: MarketMapBooth[] = [];

  Object.entries(zoneCounts).forEach(([zone, count]) => {
    for (let index = 0; index < count; index += 1) {
      const code = `${zone}${String(index + 1).padStart(2, '0')}`;
      const [x, y] = boothCoordinates[zone][index];

      booths.push({
        id: code,
        code,
        zone: `${zone}\u5340`,
        ...createPosition(x, y),
        status: 'available',
        size: '3m x 3m x 2.5m',
      });
    }
  });

  booths.push({
    id: 'service-booth',
    code: '\u670d\u52d9\u8655',
    zone: '\u670d\u52d9\u8655',
    ...createPosition(0, 232),
    width: 46,
    labelX: 23,
    status: 'occupied',
    size: '\u670d\u52d9\u6524\u4f4d',
  });

  return booths;
};

export const DEFAULT_MARKET_MAP_DATA: MarketMapData = {
  name: '\u5c0f\u96c6\u65e5\u5e02\u96c6',
  width: 1000,
  height: 580,
  booths: createBooths(),
  facilities: [
    { id: 'service', label: '', icon: 'bi-info-circle', x: 0, y: 104, width: 158, height: 112 },
    { id: 'building-left-tall', label: '', icon: 'bi-building', x: 174, y: 8, width: 180, height: 208 },
    { id: 'building-top-a', label: '', icon: 'bi-building', x: 412, y: 8, width: 166, height: 96 },
    { id: 'building-top-b', label: '', icon: 'bi-building', x: 594, y: 8, width: 166, height: 96 },
    { id: 'building-top-c', label: '', icon: 'bi-building', x: 776, y: 8, width: 166, height: 96 },
    { id: 'building-mid-a', label: '', icon: 'bi-building', x: 412, y: 120, width: 166, height: 96 },
    { id: 'building-mid-b', label: '', icon: 'bi-building', x: 594, y: 120, width: 166, height: 96 },
    { id: 'building-mid-c', label: '', icon: 'bi-building', x: 776, y: 120, width: 166, height: 96 },
    { id: 'building-row-a', label: '', icon: 'bi-building', x: 412, y: 316, width: 166, height: 96 },
    { id: 'building-row-b', label: '', icon: 'bi-building', x: 594, y: 316, width: 166, height: 96 },
    { id: 'building-row-c', label: '', icon: 'bi-building', x: 776, y: 316, width: 166, height: 96 },
    {
      id: 'building-left-l',
      label: '',
      icon: 'bi-building',
      x: 126,
      y: 316,
      width: 228,
      height: 222,
      path: 'M134 430 H214 Q222 430 222 422 V324 Q222 316 230 316 H346 Q354 316 354 324 V530 Q354 538 346 538 H134 Q126 538 126 530 V438 Q126 430 134 430 Z',
    },
    { id: 'building-bottom-a', label: '', icon: 'bi-building', x: 412, y: 442, width: 166, height: 96 },
    { id: 'building-bottom-b', label: '', icon: 'bi-building', x: 594, y: 442, width: 166, height: 96 },
    { id: 'building-bottom-c', label: '', icon: 'bi-building', x: 776, y: 442, width: 166, height: 96 },
  ],
};

@Component({
  selector: 'app-market-map',
  imports: [CommonModule, RouterLink, Dropdown],
  templateUrl: './market-map.html',
  styleUrl: './market-map.scss',
})
export class MarketMap implements OnChanges, OnInit {
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  @ViewChild('mapViewport') private mapViewport?: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenMapStage') private fullscreenMapStage?: ElementRef<HTMLDivElement>;

  @Input() mode: MarketMapMode = 'public';
  @Input() mapData: MarketMapData = DEFAULT_MARKET_MAP_DATA;
  @Input() activePublicBoothCode = '';
  @Input() launchOnly = false;
  @Input() fullscreenDateOptions: string[] = [];
  @Input() fullscreenSelectedDate = '';
  @Input() fullscreenAllSelected = false;
  @Output() boothSelected = new EventEmitter<MarketMapBooth>();
  @Output() fullscreenDateSelected = new EventEmitter<string>();
  @Output() fullscreenAction = new EventEmitter<void>();

  selectedBooth: MarketMapBooth | null = null;
  hoveredBooth: MarketMapBooth | null = null;
  isPreviewPinned = false;
  isPreviewClosing = false;
  isFullscreenMap = false;
  isFullscreenClosing = false;
  hasPublicBrandSelection = false;
  activePublicTab: PublicMapTab = 'directory';
  searchText = '';
  selectedZone = 'all';
  zoom = 1;
  readonly organizerDates = ['2026/07/18', '2026/07/19'];
  selectedOrganizerDate = this.organizerDates[0];
  private hoverPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private fullscreenCloseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly mapPaddingX = mapPaddingX;
  readonly mapPaddingTop = mapPaddingTop;
  readonly mapPaddingBottom = mapPaddingBottom;
  readonly zones = ['A', 'B', 'C'];
  readonly trees: Point[] = [
    [66, 28], [126, 28],
    [586, 15], [768, 15], [948, 15],
    [948, 156],
    [68, 345], [68, 471],
    [586, 476], [768, 476],
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['mapData'] || this.mode !== 'public') {
      return;
    }

    const activeCode = this.activePublicBoothCode
      || this.selectedBooth?.code
      || this.hoveredBooth?.code;
    if (!activeCode) {
      return;
    }

    const updatedBooth = this.mapData.booths.find((booth) => booth.code === activeCode) ?? null;
    if (!updatedBooth) {
      this.clearPreviewState();
      return;
    }

    this.hoveredBooth = updatedBooth;
    this.selectedBooth = updatedBooth;
    this.hasPublicBrandSelection = Boolean(updatedBooth.brand);
    this.isPreviewPinned = Boolean(updatedBooth.brand);
  }
  ngOnInit(): void {
    if (this.mode !== 'organizer-view' || this.selectedBooth) {
      return;
    }

    this.selectedBooth = this.mapData.booths.find((booth) => this.isOrganizerBoothSelected(booth))
      ?? null;
  }

  get viewBox(): string {
    const paddedWidth = this.mapData.width + this.mapPaddingX * 2;
    const paddedHeight = this.mapData.height + this.mapPaddingTop + this.mapPaddingBottom;
    const width = paddedWidth / this.zoom;
    const height = paddedHeight / this.zoom;
    const x = -this.mapPaddingX + (paddedWidth - width) / 2;
    const y = -this.mapPaddingTop + (paddedHeight - height) / 2;
    return `${x} ${y} ${width} ${height}`;
  }

  get brandBooths(): MarketMapBooth[] {
    return this.mapData.booths.filter((booth) => booth.brand);
  }

  get filteredBrandBooths(): MarketMapBooth[] {
    return this.brandBooths.filter((booth) =>
      (this.selectedZone === 'all' || booth.zone.startsWith(this.selectedZone)) && this.matchesSearch(booth)
    );
  }

  get directoryBooths(): MarketMapBooth[] {
    return this.mapData.booths.filter((booth) =>
      booth.id !== 'service-booth' &&
      (this.selectedZone === 'all' || booth.zone.startsWith(this.selectedZone)) &&
      this.matchesSearch(booth)
    );
  }

  get zoneOptions(): string[] {
    return ['\u5168\u90e8', ...this.zones.map((zone) => `${zone}\u5340`)];
  }

  get selectedZoneLabel(): string {
    return this.selectedZone === 'all' ? '\u5168\u90e8' : `${this.selectedZone}\u5340`;
  }

  get directoryColumns(): MarketMapBooth[][] {
    const columnCount = 6;
    const columns: MarketMapBooth[][] = Array.from({ length: columnCount }, () => []);
    this.directoryBooths.forEach((booth, index) => columns[index % columnCount].push(booth));
    return columns;
  }

  get previewBooth(): MarketMapBooth | null {
    if (this.mode !== 'public') {
      return null;
    }

    return this.selectedBooth;
  }

  get mobileSelectedBooth(): MarketMapBooth | null {
    if (this.mode !== 'public') {
      return null;
    }

    return this.selectedBooth ?? null;
  }

  isInteractiveBooth(booth: MarketMapBooth): boolean {
    return this.mode !== 'vendor-view' && (this.mode !== 'public' || booth.id !== 'service-booth');
  }

  get vendorSelectedBooth(): MarketMapBooth | null {
    if (this.mode !== 'select' && this.mode !== 'vendor-view') {
      return null;
    }

    return this.selectedBooth
      ?? this.mapData.booths.find((booth) => booth.status === 'selected' || booth.status === 'mine')
      ?? null;
  }

  get isVendorDashboardMode(): boolean {
    return this.mode === 'select' || this.mode === 'vendor-view';
  }

  setPublicTab(tab: PublicMapTab): void {
    this.activePublicTab = tab;
  }

  selectZone(zone: string): void {
    this.selectedZone = zone;
  }

  selectZoneByLabel(label: string): void {
    this.selectZone(label === '\u5168\u90e8' ? 'all' : label.replace('\u5340', ''));
  }

  boothClass(booth: MarketMapBooth): string {
    const visibleStatus = this.mode === 'organizer-view'
      ? (this.isOrganizerBoothSelected(booth) ? 'selected' : 'available')
      : booth.status;
    const classes = [`booth-${visibleStatus}`, `zone-${booth.code.charAt(0).toLowerCase()}`];

    if (booth.id === 'service-booth') {
      classes.push('booth-service');
    }

    const activeBoothId = this.mode === 'public' ? this.previewBooth?.id : this.selectedBooth?.id;
    if (booth.id === activeBoothId) {
      classes.push('is-active');
    }

    if (this.searchText && !this.matchesSearch(booth)) {
      classes.push('is-muted');
    }

    return classes.join(' ');
  }

  isOrganizerBoothSelected(booth: MarketMapBooth): boolean {
    return booth.status === 'selected' || booth.status === 'mine';
  }

  selectBooth(booth: MarketMapBooth): void {
    if (this.mode === 'vendor-view' || booth.id === 'service-booth') {
      return;
    }


    if (this.mode === 'select' && booth.status === 'occupied') {
      return;
    }

    if (this.mode === 'public') {
      // Clicking can happen while the delayed hover preview is still pending.
      // Cancel it so the stale booth object (before its brand API response)
      // cannot overwrite the selected booth after the brand has been loaded.
      this.clearHoverPreviewTimer();
      this.clearPreviewCloseTimer();
      this.isPreviewClosing = false;
      this.hoveredBooth = booth;
      this.selectedBooth = booth;
      this.hasPublicBrandSelection = Boolean(booth.brand);
      this.isPreviewPinned = Boolean(booth.brand);
      this.activePublicTab = 'detail';
      this.boothSelected.emit(booth);
      return;
    }

    this.selectedBooth = booth;
    this.boothSelected.emit(booth);
  }

  selectBrand(booth: MarketMapBooth): void {
    if (this.mode === 'public') {
      this.clearPreviewCloseTimer();
      this.isPreviewClosing = false;
      this.hoveredBooth = booth;
      this.selectedBooth = booth;
      this.hasPublicBrandSelection = Boolean(booth.brand);
      this.isPreviewPinned = Boolean(booth.brand);
      this.activePublicTab = 'detail';
      this.boothSelected.emit(booth);
    } else {
      this.selectedBooth = booth;
    }
    document.getElementById(`market-booth-${booth.id}`)?.focus({ preventScroll: true });
  }

  showBoothPreview(booth: MarketMapBooth): void {
    if (this.mode !== 'public' || booth.id === 'service-booth') {
      return;
    }

    this.clearHoverPreviewTimer();
    this.hoverPreviewTimer = setTimeout(() => {
      this.clearPreviewCloseTimer();
      this.isPreviewClosing = false;
      this.hoveredBooth = booth;
      this.selectedBooth = booth;
      this.hasPublicBrandSelection = Boolean(booth.brand);
      this.hoverPreviewTimer = null;
    }, 60);
  }

  clearBoothPreview(booth: MarketMapBooth): void {
    this.clearHoverPreviewTimer();
    if (this.hoveredBooth?.id === booth.id) {
      this.hoveredBooth = null;
    }
  }

  clearPublicBoothSelection(): void {
    if (this.mode !== 'public') {
      return;
    }

    this.clearHoverPreviewTimer();
    this.hoveredBooth = null;
    this.isPreviewPinned = false;

    if (!this.selectedBooth || this.isPreviewClosing) {
      return;
    }

    this.isPreviewClosing = true;
    this.clearPreviewCloseTimer();
    this.previewCloseTimer = setTimeout(() => {
      this.selectedBooth = null;
      this.hasPublicBrandSelection = false;
      this.isPreviewClosing = false;
      this.previewCloseTimer = null;
    }, 180);
  }

  onPublicMapBackgroundClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.booth, .booth-preview-fo')) {
      return;
    }

    this.clearPublicBoothSelection();
  }

  /** ??瘣餃??交?嚗????嚗??文?銝撘萄??銝??支??汗??撠?*/
  resetPublicMapState(): void {
    this.clearPreviewState();
    this.searchText = '';
    this.selectedZone = 'all';
  }

  showPublicBoothBrand(stallNo: string): void {
    if (this.mode !== 'public') return;

    const booth = this.mapData.booths.find((item) => item.code === stallNo) ?? null;
    if (!booth?.brand) {
      this.clearPreviewState();
      return;
    }

    this.clearHoverPreviewTimer();
    this.clearPreviewCloseTimer();
    this.isPreviewClosing = false;
    this.hoveredBooth = booth;
    this.selectedBooth = booth;
    this.hasPublicBrandSelection = true;
    this.isPreviewPinned = true;
  }

  previewX(booth: MarketMapBooth): number {
    const tooltipWidth = 420;
    const mapGap = 12;
    const minX = 8;
    const maxX = this.mapData.width - tooltipWidth - 8;

    const hasRoomOnRight = booth.x + booth.width + mapGap + tooltipWidth <= this.mapData.width - 8;
    const shouldOpenLeft = booth.code.startsWith('A') && booth.x > this.mapData.width * 0.58;
    const preferredX = hasRoomOnRight
      ? booth.x + booth.width + mapGap
      : booth.x - tooltipWidth - mapGap;

    if (shouldOpenLeft) {
      return Math.max(minX, Math.min(booth.x - tooltipWidth - mapGap, maxX));
    }

    return Math.max(minX, Math.min(preferredX, maxX));
  }

  previewY(booth: MarketMapBooth): number {
    const tooltipHeight = 340;
    const minY = 8;
    const maxY = this.mapData.height - tooltipHeight - 28;

    if (booth.code.startsWith('A')) {
      return Math.max(minY, Math.min(96, maxY));
    }

    const preferredY = booth.y - 122;
    return Math.max(minY, Math.min(preferredY, maxY));
  }

  updateSearch(event: Event): void {
    this.searchText = (event.target as HTMLInputElement).value.trim();
    const match = this.mapData.booths.find((booth) => this.matchesSearch(booth));

    if (match) {
      this.selectedBooth = match;
      this.hoveredBooth = match;
      this.hasPublicBrandSelection = true;
      this.isPreviewPinned = true;
    }
  }

  clearSearch(): void {
    this.searchText = '';
  }

  zoomIn(): void {
    this.zoom = Math.min(1.4, Number((this.zoom + 0.2).toFixed(1)));
  }

  zoomOut(): void {
    this.zoom = Math.max(0.8, Number((this.zoom - 0.2).toFixed(1)));
  }

  resetView(): void {
    this.zoom = 1;
  }

  selectFullscreenDate(date: string): void {
    if (!date || date === this.fullscreenSelectedDate) {
      return;
    }

    this.selectedBooth = null;
    this.fullscreenDateSelected.emit(date);
    window.setTimeout(() => this.centerFullscreenMap(), 0);
  }

  runFullscreenAction(): void {
    if (this.mode !== 'select' || !this.vendorSelectedBooth) {
      return;
    }

    if (!this.fullscreenAllSelected) {
      this.selectedBooth = null;
    }
    this.fullscreenAction.emit();
    window.setTimeout(() => this.centerFullscreenMap(), 0);
  }

  openFullscreenMap(): void {
    if (this.isMobileLandscape()) {
      return;
    }

    this.clearFullscreenCloseTimer();
    this.isFullscreenClosing = false;
    this.isFullscreenMap = true;
    window.setTimeout(() => this.centerFullscreenMap(), 0);
  }

  closeFullscreenMap(): void {
    if (!this.isFullscreenMap || this.isFullscreenClosing) {
      return;
    }

    this.isFullscreenClosing = true;
    this.clearPreviewState();
    this.fullscreenCloseTimer = setTimeout(() => {
      this.isFullscreenMap = false;
      this.isFullscreenClosing = false;
      this.fullscreenCloseTimer = null;
    }, 220);
  }

  @HostListener('document:keydown.escape')
  closeFullscreenMapWithEscape(): void {
    if (this.isFullscreenMap) {
      this.closeFullscreenMap();
    }
  }

  @HostListener('window:resize')
  closeFullscreenMapOnLandscape(): void {
    if (this.isFullscreenMap && this.isMobileLandscape()) {
      this.closeFullscreenMapImmediately();
    }
  }

  @HostListener('document:click', ['$event'])
  clearBoothSelectionOutside(event: MouseEvent): void {
    if (this.mode !== 'public') {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node) || this.hostElement.nativeElement.contains(target)) {
      return;
    }

    this.clearPublicBoothSelection();
  }

  boothStatusLabel(status: MarketBoothStatus): string {
    const labels: Record<MarketBoothStatus, string> = {
      available: '\u53ef\u9078\u64c7',
      occupied: '\u5df2\u914d\u7f6e\u54c1\u724c',
      selected: '\u5df2\u9078\u64c7',
      mine: '\u6211\u7684\u6524\u4f4d',
    };
    return labels[status];
  }

  private matchesSearch(booth: MarketMapBooth): boolean {
    if (!this.searchText) {
      return true;
    }

    const keyword = this.searchText.toLowerCase();
    return booth.code.toLowerCase().includes(keyword)
      || booth.brand?.name.toLowerCase().includes(keyword) === true
      || booth.brand?.category.toLowerCase().includes(keyword) === true;
  }

  private clearPreviewState(): void {
    this.clearHoverPreviewTimer();
    this.clearPreviewCloseTimer();
    this.selectedBooth = null;
    this.hoveredBooth = null;
    this.hasPublicBrandSelection = false;
    this.isPreviewPinned = false;
    this.isPreviewClosing = false;
  }

  private closeFullscreenMapImmediately(): void {
    this.clearFullscreenCloseTimer();
    this.isFullscreenMap = false;
    this.isFullscreenClosing = false;
    this.clearPreviewState();
  }

  private isMobileLandscape(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(max-width: 932px) and (orientation: landscape)').matches;
  }

  private clearHoverPreviewTimer(): void {
    if (!this.hoverPreviewTimer) {
      return;
    }

    clearTimeout(this.hoverPreviewTimer);
    this.hoverPreviewTimer = null;
  }

  private clearPreviewCloseTimer(): void {
    if (!this.previewCloseTimer) {
      return;
    }

    clearTimeout(this.previewCloseTimer);
    this.previewCloseTimer = null;
  }

  private clearFullscreenCloseTimer(): void {
    if (!this.fullscreenCloseTimer) {
      return;
    }

    clearTimeout(this.fullscreenCloseTimer);
    this.fullscreenCloseTimer = null;
  }

  private centerFullscreenMap(): void {
    const stage = this.fullscreenMapStage?.nativeElement;
    if (!stage || !this.isFullscreenMap) {
      return;
    }

    const maxScrollLeft = Math.max(stage.scrollWidth - stage.clientWidth, 0);
    stage.scrollTo({
      left: Math.round(maxScrollLeft * 0.46),
      top: 0,
      behavior: 'auto',
    });
  }
}


