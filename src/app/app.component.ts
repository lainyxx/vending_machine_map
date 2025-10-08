import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    const firebaseConfig = environment.firebase;
    initializeApp(firebaseConfig);  // ← ここで一度だけ初期化
    this.initApp();
  }

  async initApp() {
    try {
      // ステータスバーをWebViewの上に重ねない
      await StatusBar.setOverlaysWebView({ overlay: false });

      // ステータスバーの背景色を設定
      await StatusBar.setBackgroundColor({ color: '#ffffff' });

      // ステータスバー文字色を黒に
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (err) {
      console.warn('StatusBar plugin not available', err);
    }
  }
}
