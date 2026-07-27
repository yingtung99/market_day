import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { from, map } from 'rxjs';

import { OrganizerAccessService } from '../core/services/organizer-access.service';

/** 主辦方資料與藍新 NT$1 驗證皆完成後，才允許進入管理功能。 */
export const organizerSetupGuard: CanActivateFn = () => {
  const organizerAccess = inject(OrganizerAccessService);
  const router = inject(Router);

  return from(organizerAccess.initialize(true)).pipe(
    map(() => organizerAccess.setupCompleted()
      ? true
      : router.createUrlTree(['/organizer/dash-board/home'])),
  );
};
