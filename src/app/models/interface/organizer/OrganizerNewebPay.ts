export type OrganizerNewebPayVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED';

export interface OrganizerNewebPayPortal {
  registrationUrl: string;
  loginUrl: string;
}

export interface OrganizerNewebPayAccount {
  bound: boolean;
  merchantId: string | null;
  hashKey: string;
  hashIv: string;
  status: string | null;
  verificationStatus: OrganizerNewebPayVerificationStatus;
  verifiedAt: string | null;
  updatedAt: string | null;
}

export interface OrganizerNewebPaySaveRequest {
  merchantId: string;
  hashKey: string;
  hashIv: string;
}

export interface OrganizerNewebPaySaveResponse {
  merchantId: string;
  status: string;
  updatedAt: string;
}

export interface OrganizerNewebPayVerificationForm {
  verificationNo: string;
  amount: number;
  gateway: string;
  merchantId: string;
  tradeInfo: string;
  tradeSha: string;
  version: string;
}
