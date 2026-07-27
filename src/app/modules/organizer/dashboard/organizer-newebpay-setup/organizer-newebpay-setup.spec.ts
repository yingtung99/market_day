import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AlertService } from '../../../../core/services/alert.service';
import { OrganizerAccessService } from '../../../../core/services/organizer-access.service';
import { OrganizerApiService } from '../../../../core/services/organizer-api.service';
import { OrganizerNewebPayAccount } from '../../../../models/interface/organizer/OrganizerNewebPay';
import { OrganizerNewebPaySetup } from './organizer-newebpay-setup';

describe('OrganizerNewebPaySetup', () => {
  let component: OrganizerNewebPaySetup;
  let fixture: ComponentFixture<OrganizerNewebPaySetup>;
  let organizerApi: jasmine.SpyObj<OrganizerApiService>;
  let organizerAccess: jasmine.SpyObj<OrganizerAccessService>;
  let alert: jasmine.SpyObj<AlertService>;

  const unverifiedAccount: OrganizerNewebPayAccount = {
    bound: false,
    merchantId: null,
    hashKey: '',
    hashIv: '',
    status: null,
    verificationStatus: 'UNVERIFIED',
    verifiedAt: null,
    updatedAt: null,
  };

  const boundAccount: OrganizerNewebPayAccount = {
    ...unverifiedAccount,
    bound: true,
    merchantId: 'MS123456789',
    status: 'ACTIVE',
    updatedAt: '2026-07-27T10:00:00',
  };

  beforeEach(async () => {
    organizerApi = jasmine.createSpyObj<OrganizerApiService>('OrganizerApiService', [
      'getOrganizerNewebPayPortal',
      'getOrganizerNewebPayAccount',
      'saveOrganizerNewebPayAccount',
      'verifyOrganizerNewebPayAccount',
    ]);
    organizerAccess = jasmine.createSpyObj<OrganizerAccessService>('OrganizerAccessService', [
      'refresh',
    ]);
    alert = jasmine.createSpyObj<AlertService>('AlertService', ['success', 'error']);

    organizerApi.getOrganizerNewebPayPortal.and.returnValue(of({
      statusCode: 200,
      message: 'OK',
      messageDetails: null,
      data: {
        registrationUrl: 'https://www.newebpay.com/website/Page/content/register',
        loginUrl: 'https://cwww.newebpay.com/',
      },
    }));
    organizerApi.getOrganizerNewebPayAccount.and.returnValue(of({
      statusCode: 200,
      message: 'OK',
      messageDetails: null,
      data: unverifiedAccount,
    }));
    organizerAccess.refresh.and.resolveTo(false);
    alert.success.and.resolveTo({ isConfirmed: true } as never);
    alert.error.and.resolveTo({ isConfirmed: true } as never);

    await TestBed.configureTestingModule({
      imports: [OrganizerNewebPaySetup],
      providers: [
        provideRouter([]),
        { provide: OrganizerApiService, useValue: organizerApi },
        { provide: OrganizerAccessService, useValue: organizerAccess },
        { provide: AlertService, useValue: alert },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                has: () => false,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizerNewebPaySetup);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the portal links and current payment account', () => {
    expect(component.isLoading).toBeFalse();
    expect(component.portal?.loginUrl).toBe('https://cwww.newebpay.com/');
    expect(component.account).toEqual(unverifiedAccount);
    expect(organizerApi.getOrganizerNewebPayPortal).toHaveBeenCalled();
    expect(organizerApi.getOrganizerNewebPayAccount).toHaveBeenCalled();
  });

  it('does not save an invalid form and marks the fields as touched', async () => {
    await component.save();

    expect(component.form.controls.merchantId.touched).toBeTrue();
    expect(component.form.controls.hashKey.touched).toBeTrue();
    expect(component.form.controls.hashIv.touched).toBeTrue();
    expect(organizerApi.saveOrganizerNewebPayAccount).not.toHaveBeenCalled();
  });

  it('saves valid merchant credentials and reloads the account state', async () => {
    organizerApi.saveOrganizerNewebPayAccount.and.returnValue(of({
      statusCode: 200,
      message: 'OK',
      messageDetails: null,
      data: {
        merchantId: 'MS123456789',
        status: 'ACTIVE',
        updatedAt: '2026-07-27T10:00:00',
      },
    }));
    organizerApi.getOrganizerNewebPayAccount.and.returnValue(of({
      statusCode: 200,
      message: 'OK',
      messageDetails: null,
      data: boundAccount,
    }));
    component.form.setValue({
      merchantId: ' MS123456789 ',
      hashKey: '12345678901234567890123456789012',
      hashIv: '1234567890123456',
    });

    await component.save();

    expect(organizerApi.saveOrganizerNewebPayAccount).toHaveBeenCalledWith({
      merchantId: 'MS123456789',
      hashKey: '12345678901234567890123456789012',
      hashIv: '1234567890123456',
    });
    expect(component.account).toEqual(boundAccount);
    expect(component.form.controls.hashKey.value).toBe('');
    expect(component.form.controls.hashIv.value).toBe('');
    expect(organizerAccess.refresh).toHaveBeenCalled();
    expect(alert.success).toHaveBeenCalled();
  });

  it('submits the NT$1 verification form returned by the backend', async () => {
    component.account = boundAccount;
    organizerApi.verifyOrganizerNewebPayAccount.and.returnValue(of({
      statusCode: 200,
      message: 'OK',
      messageDetails: null,
      data: {
        verificationNo: 'VERIFY001',
        amount: 1,
        gateway: 'https://ccore.newebpay.com/MPG/mpg_gateway',
        merchantId: 'MS123456789',
        tradeInfo: 'trade-info',
        tradeSha: 'trade-sha',
        version: '2.0',
      },
    }));
    const submitSpy = spyOn(HTMLFormElement.prototype, 'submit');

    await component.verify();

    const form = document.body.querySelector<HTMLFormElement>(
      'form[action="https://ccore.newebpay.com/MPG/mpg_gateway"]',
    );
    expect(form).not.toBeNull();
    expect(form?.method.toUpperCase()).toBe('POST');
    expect(form?.querySelector<HTMLInputElement>('input[name="MerchantID"]')?.value)
      .toBe('MS123456789');
    expect(form?.querySelector<HTMLInputElement>('input[name="TradeInfo"]')?.value)
      .toBe('trade-info');
    expect(form?.querySelector<HTMLInputElement>('input[name="TradeSha"]')?.value)
      .toBe('trade-sha');
    expect(form?.querySelector<HTMLInputElement>('input[name="Version"]')?.value)
      .toBe('2.0');
    expect(submitSpy).toHaveBeenCalled();

    form?.remove();
  });
});
