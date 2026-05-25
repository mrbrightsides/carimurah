export type InputMode = "camera" | "upload" | "voice" | "manual" | "dashboard" | "compare" | "settings" | "pricing" | "rfq" | "watchlist";

export type SubscriptionTier = "FREE" | "PRO" | "ENTERPRISE";

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export interface LandedCost {
  basePrice: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface MarketOption {
  platform: string;
  price: number;
  url: string;
  rating: number;
  deliveryDays: string;
  bulkDiscount: string;
  stockStatus: string;
  isWinner?: boolean;
  isUser?: boolean;
  // Supplier Metrics
  supplierRating?: number;
  reliabilityScore?: number;
  totalOrders?: number;
  forecasting?: {
    trend: 'up' | 'down' | 'stable';
    predictedNextWeek: number;
    reason?: string;
    history: PriceHistoryPoint[];
  };
}

export interface Review {
  user: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ItemAnalysis {
  productName: string;
  brand: string;
  currentPrice: number;
  recommendedPrice: number;
  platform: string;
  url: string;
  saving: number;
  rating?: number;
  deliveryDays?: string;
  bulkDiscount?: string;
  features?: string[];
  stockStatus?: string;
  alternatives?: MarketOption[];
  reviews?: Review[];
  supplierRating?: number;
  reliabilityScore?: number;
  landedCost?: LandedCost;
  isWinner?: boolean;
  minPriceDrop?: number;
  forecasting?: {
    trend: 'up' | 'down' | 'stable';
    predictedNextWeek: number;
    reason?: string;
    history: PriceHistoryPoint[];
  };
}

export interface AuditInsight {
  wasteCategory: string;
  recommendation: string;
  potentialAnnualSaving: number;
  details?: string[];
}

export interface BatchAnalysisResult {
  items: ItemAnalysis[];
  totalCurrentSpent: number;
  totalRecommendedSpent: number;
  totalPotentialSavings: number;
  summaryVoice: string;
  auditInsights?: AuditInsight[];
  rfqStatus?: 'draft' | 'sent' | 'approved';
}

export interface AnalysisState {
  step: "parsing" | "searching" | "deciding" | "complete" | "error";
  batchResult?: BatchAnalysisResult;
  isCached?: boolean;
  error?: string;
}

export interface HistoryItem {
  id: string;
  date: string;
  totalSaved: number;
  itemsCount: number;
  type: "B2C" | "B2B";
  result: BatchAnalysisResult;
  note?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  subscription: {
    tier: SubscriptionTier;
    expiresAt?: string;
  };
  preferences: {
    currency: 'IDR' | 'USD' | 'MYR';
    language: 'id' | 'en';
    notifyOnBetterPrices: boolean;
    b2bFocus: "price" | "delivery" | "rating";
    showTrendChartsByDefault: boolean;
  };
}
