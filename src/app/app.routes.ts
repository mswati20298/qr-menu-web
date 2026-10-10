import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { kitchenGuard } from './core/guards/kitchen.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'superadmin/login',
    loadComponent: () => import('./super-admin/super-admin-login/super-admin-login').then((m) => m.SuperAdminLogin)
  },
  {
    path: 'superadmin',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./super-admin/super-admin-layout/super-admin-layout').then((m) => m.SuperAdminLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./super-admin/super-admin-dashboard/super-admin-dashboard').then((m) => m.SuperAdminDashboard)
      },
      {
        path: 'restaurants',
        loadComponent: () =>
          import('./super-admin/super-admin-restaurants/super-admin-restaurants').then((m) => m.SuperAdminRestaurants)
      },
      {
        path: 'plans',
        loadComponent: () => import('./super-admin/super-admin-plans/super-admin-plans').then((m) => m.SuperAdminPlans)
      },
      {
        path: 'payments',
        loadComponent: () => import('./super-admin/super-admin-payments/super-admin-payments').then((m) => m.SuperAdminPayments)
      },
      {
        path: 'testimonials',
        loadComponent: () => import('./super-admin/super-admin-feedback/super-admin-feedback').then((m) => m.SuperAdminFeedback)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./super-admin/super-admin-settings/super-admin-settings').then((m) => m.SuperAdminSettings)
      },
      { path: '**', redirectTo: '' }
    ]
  },
  // Kitchen display: full screen, outside the admin layout.
  {
    path: 'kitchen/login',
    loadComponent: () => import('./kitchen/kitchen-login/kitchen-login').then((m) => m.KitchenLogin)
  },
  {
    path: 'kitchen',
    canActivate: [kitchenGuard],
    loadComponent: () => import('./kitchen/kitchen-board/kitchen-board').then((m) => m.KitchenBoard)
  },
  {
    path: 'm/:slug',
    loadComponent: () => import('./public-menu/customer-shell/customer-shell').then((m) => m.CustomerShell),
    children: [
      { path: '', redirectTo: 'menu', pathMatch: 'full' },
      { path: 'menu', data: { preload: true }, loadComponent: () => import('./public-menu/menu-tab/menu-tab').then((m) => m.MenuTab) },
      { path: 'cart', data: { preload: true }, loadComponent: () => import('./public-menu/cart-tab/cart-tab').then((m) => m.CartTab) },
      { path: 'orders', data: { preload: true }, loadComponent: () => import('./public-menu/orders-tab/orders-tab').then((m) => m.OrdersTab) },
      // Full-screen page: same background and theme as the menu, but no bottom tab bar.
      {
        path: 'item/:itemId',
        data: { hideNav: true, preload: true },
        loadComponent: () => import('./public-menu/item-detail-page/item-detail-page').then((m) => m.ItemDetailPage)
      },
      // Order status keeps the tab bar, so a guest can go back to the menu, their orders or Help from it.
      {
        path: 'order/:orderId',
        data: { preload: true },
        loadComponent: () => import('./public-menu/order-status-page/order-status-page').then((m) => m.OrderStatusPage)
      }
    ]
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/login/login').then((m) => m.Login)
  },
  {
    path: 'admin/forgot-password',
    loadComponent: () => import('./admin/forgot-password/forgot-password').then((m) => m.ForgotPassword)
  },
  {
    path: 'admin/register',
    loadComponent: () => import('./admin/register/register').then((m) => m.Register)
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/layout/admin-layout').then((m) => m.AdminLayout),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./admin/dashboard/dashboard-page').then((m) => m.DashboardPage) },
      { path: 'orders', loadComponent: () => import('./admin/orders/orders-page').then((m) => m.OrdersPage) },
      { path: 'requests', loadComponent: () => import('./admin/requests/requests-page').then((m) => m.RequestsPage) },
      { path: 'reviews', loadComponent: () => import('./admin/reviews/reviews-page').then((m) => m.ReviewsPage) },
      { path: 'menu', loadComponent: () => import('./admin/menu/menu-page').then((m) => m.MenuPage) },
      { path: 'tables', loadComponent: () => import('./admin/tables/tables-page').then((m) => m.TablesPage) },
      { path: 'qr', loadComponent: () => import('./admin/qr/qr-page').then((m) => m.QrPage) },
      { path: 'settings', loadComponent: () => import('./admin/settings/settings-page').then((m) => m.SettingsPage) },
      { path: 'plan', loadComponent: () => import('./admin/plan/plan-page').then((m) => m.PlanPage) },
      { path: 'invoices', loadComponent: () => import('./admin/invoices/invoices-page').then((m) => m.InvoicesPage) },
      { path: 'invoices/new', loadComponent: () => import('./admin/new-bill/new-bill-page').then((m) => m.NewBillPage) }
    ]
  },
  { path: '**', redirectTo: 'admin' }
];
