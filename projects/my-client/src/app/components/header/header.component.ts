import { Component, ChangeDetectionStrategy, signal } from '@angular/core';


@Component({
    selector: 'app-header',
    imports: [],
    templateUrl: './header.component.html',
    styleUrl: './header.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  // State using Signals
  activeMenu = signal<string>('products');

  // Asset paths
  readonly assets = {
    icon1: 'assets/04ff4911162dc0c16135d97b21dcad117192621b.png',
    icon2: 'assets/ba2a506d58ea6a7e6fa0192d6e841831806c3981.png',
    icon3: 'assets/0e69c190680bbaf4eabbd6a9fcd7403ed66c1741.png',
    icon4: 'assets/5a7d80d715d44d479e3f007c460888c8a8c24722.png',
    logo: 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png'
  };

  // Menu items config for @for loop
  readonly menuItems = [
    { id: 'products', label: 'SẢN PHẨM' },
    { id: 'guide', label: 'HƯỚNG DẪN' },
    { id: 'auralab', label: 'AURALAB' },
    { id: 'support', label: 'HỖ TRỢ' }
  ];

  setActiveMenu(menuId: string): void {
    this.activeMenu.set(menuId);
  }

  toggleSearch(): void {
    console.log('Toggle search');
  }

  openCart(): void {
    console.log('Open cart');
  }
}
// Trigger rebuild
