import { Routes } from '@angular/router';

export const routes: Routes = [
  // {
  //   path: '',
  //   loadChildren: () => import('./tab1/tab1.page').then((m) => m.Tab1Page),
  // },
  {
    path: '',
    loadComponent: () => import('./map/map.page').then( m => m.MapPage)
  },
];
