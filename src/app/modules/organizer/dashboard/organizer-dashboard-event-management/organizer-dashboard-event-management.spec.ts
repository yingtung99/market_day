import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { ActivityStatus } from '../../../../models/status/ActivityStatus';
import { OrganizerDashboardEventManagement } from './organizer-dashboard-event-management';

describe('OrganizerDashboardEventManagement', () => {
  let component: OrganizerDashboardEventManagement;
  let fixture: ComponentFixture<OrganizerDashboardEventManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizerDashboardEventManagement],
      providers: [
        provideRouter([]),
        {
          provide: OrganizerApiService,
          useValue: {
            searchOrganizerEvents: () => of({
              statusCode: 200,
              message: 'OK',
              messageDetails: null,
              data: {
                taskSummary: {
                  pendingReviewCount: 0,
                  pendingRefundConfirmationCount: 0,
                  pendingStallSelectionCount: 0,
                  pendingPublishCount: 0,
                },
                totalCount: 0,
                events: { items: [] },
              },
            }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganizerDashboardEventManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('補件中只顯示編輯與重新送審', () => {
    const actions = (component as any).getRowActions({ status: ActivityStatus.revisionRequired });

    expect(actions.map((action: { key: string }) => action.key)).toEqual(['edit', 'resubmit']);
    expect(actions.map((action: { label: string }) => action.label)).toEqual(['編輯', '重新送審']);
  });
});
