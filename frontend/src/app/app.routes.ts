import { Routes } from '@angular/router';

// Layouts
import { MainLayout } from './layout/main-layout/main-layout';
import { AdminLayout } from './pages/admin/admin-layout';

// Customer pages
import { Dashboard } from './pages/dashboard/dashboard';
import { Calls } from './pages/calls/calls';
import { Contacts } from './pages/contacts/contacts';
import { Notifications } from './pages/notifications/notifications';
import { Settings } from './pages/settings/settings';

import { NotFound } from './pages/not-found/not-found';

// Authentication
import { Login } from './pages/login/login';

// Admin pages
import { AdminDashboard } from './pages/admin/dashboard/admin-dashboard';

// Guards
import { authGuard } from './core/auth/auth.guard';
import { superAdminGuard, customerGuard } from './core/role.guard';
import { AdminClients } from './pages/admin/clients/admin-clients';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    component: Login,
  },

  // Super Admin Portal
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard, superAdminGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: AdminDashboard,
      },
      // Próximamente:
      { path: 'clients', component: AdminClients },
      // { path: 'plans', component: AdminPlans },
      // { path: 'billing', component: AdminBilling },
    ],
  },

  // Customer Portal
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard, customerGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: Dashboard,
      },
      {
        path: 'calls',
        component: Calls,
      },
      {
        path: 'contacts',
        component: Contacts,
      },
      {
        path: 'notifications',
        component: Notifications,
      },
      {
        path: 'settings',
        component: Settings,
      },
    ],
  },

  // Unknown routes
  {
    path: '**',
    component: NotFound,
  },
];
