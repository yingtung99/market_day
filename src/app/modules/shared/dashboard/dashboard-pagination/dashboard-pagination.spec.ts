import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardPagination } from './dashboard-pagination';

describe('DashboardPagination', () => {
  let component: DashboardPagination;
  let fixture: ComponentFixture<DashboardPagination>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPagination]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardPagination);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show five pages centered on the current page', () => {
    component.totalItems = 140;
    component.pageSize = 6;
    component.currentPage = 11;

    expect(component.pages()).toEqual([9, 10, 11, 12, 13]);
  });

  it('should keep five pages visible at the beginning and end', () => {
    component.totalItems = 140;
    component.pageSize = 6;

    component.currentPage = 1;
    expect(component.pages()).toEqual([1, 2, 3, 4, 5]);

    component.currentPage = 24;
    expect(component.pages()).toEqual([20, 21, 22, 23, 24]);
  });

  it('should show every page when there are fewer than five pages', () => {
    component.totalItems = 18;
    component.pageSize = 6;

    expect(component.pages()).toEqual([1, 2, 3]);
  });
});
