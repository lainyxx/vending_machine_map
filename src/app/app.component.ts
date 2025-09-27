import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    const firebaseConfig = environment.firebase;
    initializeApp(firebaseConfig);  // ← ここで一度だけ初期化
  }
}
