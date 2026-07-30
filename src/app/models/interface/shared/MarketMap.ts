export type MarketMapMode = 'public' | 'select' | 'vendor-view' | 'organizer-view';

export type MarketBoothStatus = 'available' | 'occupied' | 'selected' | 'mine';

export interface MarketMapBrand {
  id: string;
  name: string;
  category: string;
  summary: string;
  logo: string;
  socialLinks?: MarketMapBrandLink[];
}

export interface MarketMapBrandLink {
  type: 'facebook' | 'instagram' | 'website';
  label: string;
  url: string;
}

export interface MarketMapBooth {
  id: string;
  code: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: 'rect' | 'circle';
  labelX?: number;
  labelY?: number;
  status: MarketBoothStatus;
  size: string;
  brand?: MarketMapBrand;
  applicationId?: number;
  vendorOwnerName?: string;
  selectedAt?: string;
}

export interface MarketMapFacility {
  id: string;
  label: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  path?: string;
}

export interface MarketMapData {
  name: string;
  width: number;
  height: number;
  booths: MarketMapBooth[];
  facilities: MarketMapFacility[];
}
