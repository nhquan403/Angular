import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/guards';
import { unsavedChangesGuard } from './features/todos/unsaved-changes-guard';

/**
 * Bản đồ đường dẫn của ứng dụng.
 * loadComponent = tải lười: mã của mỗi trang chỉ được tải khi người dùng vào trang đó.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Đăng nhập',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Đăng ký',
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    // Shell là khung chung (thanh trên cùng) của mọi trang cần đăng nhập.
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'todos' },
      {
        path: 'todos',
        title: 'Todo của tôi',
        loadComponent: () => import('./features/todos/todo-list').then((m) => m.TodoList),
      },
      {
        path: 'todos/:id',
        title: 'Chi tiết todo',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/todos/todo-detail').then((m) => m.TodoDetail),
      },
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        title: 'Quản lý người dùng',
        loadComponent: () => import('./features/admin/admin-users').then((m) => m.AdminUsers),
      },
    ],
  },
  {
    path: '**',
    title: 'Không tìm thấy',
    loadComponent: () => import('./features/not-found').then((m) => m.NotFound),
  },
];
