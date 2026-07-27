import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrganizerDashboardSetupGuide } from './organizer-dashboard-setup-guide';

describe('OrganizerDashboardSetupGuide', () => {
  let component: OrganizerDashboardSetupGuide;
  let fixture: ComponentFixture<OrganizerDashboardSetupGuide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizerDashboardSetupGuide],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganizerDashboardSetupGuide);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the two-step first-time setup flow', () => {
    const steps = fixture.nativeElement.querySelectorAll('.first-setup-progress li');

    expect(steps.length).toBe(2);
    expect(steps[0].textContent).toContain('主辦方資料');
    expect(steps[1].textContent).toContain('藍新收款設定');
  });

  it('should mark the payment step as current after the profile is completed', () => {
    component.needsProfile = false;
    fixture.detectChanges();

    const steps = fixture.nativeElement.querySelectorAll('.first-setup-progress li');
    expect(steps[0].classList).toContain('completed');
    expect(steps[1].classList).toContain('current');
  });
});
