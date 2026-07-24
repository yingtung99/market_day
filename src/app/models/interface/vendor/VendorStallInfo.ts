export interface VendorStallProduct {
  id?: number;
  productName: string;
  productPrice: number;
  productSummary: string;
  productImageUrl: string | null;
}

export interface VendorStallCategory {
  id: number;
  name: string;
  slug: string;
}

/** 攤主後台攤位資料，欄位名稱與 StallController 回傳內容一致。 */
export interface VendorStallInfo {
  brandName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  district: string;
  address: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  avatarImageUrl: string | null;
  coverImageUrl: string | null;
  brandSummary: string;
  brandDescription: string;
  category: VendorStallCategory | null;
  products: VendorStallProduct[];
}

export type VendorStallSaveRequest = Omit<VendorStallInfo, 'category'> & {
  categoryId: number;
};

export type VendorImagePurpose = 'vendor-avatar' | 'vendor-cover';

export interface StoredVendorImage {
  purpose: string;
  productId: number | null;
  eventId: number | null;
  imageUrl: string;
  contentType: string;
  fileSize: number;
}
