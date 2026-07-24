import { VendorMarketCard } from './vendor-market-card';

describe('VendorMarketCard', () => {
  let component: VendorMarketCard;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-07-24T12:00:00+08:00'));
    component = new VendorMarketCard();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('shows that registration has not started yet', () => {
    expect(
      component.getDeadlineText(
        '2026-07-25T00:00:00+08:00',
        '2026-07-30T23:59:59+08:00',
      ),
    ).toBe('報名尚未開始');
  });

  it('shows that registration has closed', () => {
    expect(
      component.getDeadlineText(
        '2026-07-01T00:00:00+08:00',
        '2026-07-24T11:59:59+08:00',
      ),
    ).toBe('報名已截止');
  });

  it('shows when registration closes today', () => {
    expect(
      component.getDeadlineText(
        '2026-07-01T00:00:00+08:00',
        '2026-07-24T23:59:59+08:00',
      ),
    ).toBe('今天報名截止');
  });

  it('shows the number of calendar days until registration closes', () => {
    expect(
      component.getDeadlineText(
        '2026-07-01T00:00:00+08:00',
        '2026-07-27T23:59:59+08:00',
      ),
    ).toBe('3 天後報名截止');
  });

  it('handles a missing or invalid registration deadline', () => {
    expect(component.getDeadlineText(undefined, undefined)).toBe('報名時間未定');
    expect(component.getDeadlineText(undefined, 'invalid-date')).toBe('報名時間未定');
  });
});
