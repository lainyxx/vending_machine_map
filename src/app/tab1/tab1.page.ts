import { Component, AfterViewInit } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
})
export class Tab1Page implements AfterViewInit {
  constructor() {}

  map!: GoogleMap;

  async ngAfterViewInit() {
    this.map = await GoogleMap.create({
      id: 'map', // HTMLで指定したID
      element: document.getElementById('map')!,
      apiKey: 'AIzaSyC-MAdmwXw9gGTwAxGMDjD1SNgKONy9sB8',
      config: {
        center: {
          lat: 35.6804,  // 東京駅
          lng: 139.7690,
        },
        zoom: 12,
      },
    });

    // マーカーを追加
    await this.map.addMarker({
      coordinate: { lat: 35.6804, lng: 139.7690 },
      title: '東京駅',
    });
  }
}
