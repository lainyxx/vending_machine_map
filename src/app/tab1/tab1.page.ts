import { Component, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA  } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { environment } from '../../environments/environment';



@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Tab1Page implements AfterViewInit {

  map!: GoogleMap;

  constructor() {}

  async ngAfterViewInit() {
    // マップ作成
    this.map = await GoogleMap.create({
      id: 'map',
      element: document.getElementById('map')!,
      apiKey: environment.googleMapsApiKey,
      config: {
        center: { lat: 35.6804, lng: 139.7690 }, // 東京駅
        zoom: 12,
      },
    });

    // マーカー追加（plain objectで座標指定）
    await this.map.addMarker({
      coordinate: { lat: 35.6804, lng: 139.7690 },
      title: '東京駅',
      snippet: 'ここから出発'
    });

  }
}
