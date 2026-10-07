export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  whatsAppNumber: string;
  openTime: string;
  closeTime: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  isGstEnabled: boolean;
  gstPercentage: number;
  isServiceChargeEnabled: boolean;
  serviceChargePercentage: number;
  showWelcomeMessage: boolean;
  welcomeMessage: string | null;
  themeColor: string;
  /** GSTIN printed on invoices. */
  gstNumber: string | null;
  invoicePrefix: string;
  upiId: string | null;
  upiPayeeName: string | null;
  /** True when a kitchen PIN is set (separate kitchen-screen login). */
  kitchenLoginEnabled: boolean;
  /** Own address name, e.g. "saket" for saket.qrenvo.com. Null = only the /m/{slug} link. */
  subdomain: string | null;
  /** Public menu address to share and print. */
  menuUrl: string;
  /** False on deployments without restaurant addresses (Demo, local). */
  subdomainsEnabled: boolean;
  rootDomain: string | null;
  /** Only phones that scanned a table's QR can order for a table. */
  requireTableQr: boolean;
  /** Hours a scan lets that phone order (1-12). */
  qrSessionHours: number;
  /** Orders without a table (takeaway) from the menu link. */
  allowLinkTakeaway: boolean;
}

export interface UpdateRestaurantRequest {
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  whatsAppNumber: string;
  openTime: string;
  closeTime: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  isGstEnabled: boolean;
  gstPercentage: number;
  isServiceChargeEnabled: boolean;
  serviceChargePercentage: number;
  showWelcomeMessage: boolean;
  welcomeMessage: string | null;
  themeColor?: string;
  gstNumber: string | null;
  invoicePrefix: string | null;
  upiId: string | null;
  upiPayeeName: string | null;
  requireTableQr?: boolean;
  qrSessionHours?: number;
  allowLinkTakeaway?: boolean;
}

export interface ScanStats {
  date: string;
  count: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface TopSellingItem {
  name: string;
  qtySold: number;
  imageUrl?: string | null;
}

/** Sales in one hour of today (Indian time). */
export interface HourlyRevenue {
  hour: number;
  revenue: number;
  orderCount: number;
}

export interface RecentOrder {
  id: string;
  tableNumber: string | null;
  itemsSummary: string;
  total: number;
  status: string;
  createdAt: string;
  imageUrl?: string | null;
}

export interface DashboardStats {
  totalOrdersToday: number;
  totalRevenueToday: number;
  averageOrderValueToday: number;
  totalOrdersYesterday: number;
  totalRevenueYesterday: number;
  averageOrderValueYesterday: number;
  activeTables: number;
  totalTables: number;
  scansLast7Days: ScanStats[];
  revenueLast7Days: DailyRevenue[];
  revenueLast30Days: DailyRevenue[];
  topSellingItems: TopSellingItem[];
  recentOrders: RecentOrder[];
  revenueTodayByHour: HourlyRevenue[];
}
