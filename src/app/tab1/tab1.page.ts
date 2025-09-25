import { Component, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA  } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';
import { environment } from '../../environments/environment';
import { Firestore, collectionData, collection, addDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { Observable } from 'rxjs';



@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Tab1Page implements AfterViewInit {
  firestore: Firestore = inject(Firestore);
  map!: GoogleMap;
  private markerIds: string[] = [];

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

    // Firestore の vendingMachines コレクションを購読
    const vendingCol = collection(this.firestore, 'vendingMachines');
    const vendingMachines$: Observable<any[]> = collectionData(vendingCol, { idField: 'id' });

    vendingMachines$.subscribe(async (machines) => {
       // 既存マーカーを削除
      if (this.markerIds.length > 0) {
        await this.map.removeMarkers(this.markerIds);
        this.markerIds = [];
      }

      // Firestore の全データをマーカーに追加
      for (const m of machines) {
        const markerId = await this.map.addMarker({
          coordinate: { lat: m.lat, lng: m.lng },
          title: '自販機',
        });
        this.markerIds.push(markerId); // ID を保存
      }
    });

    // マーカー追加（plain objectで座標指定）
    await this.map.addMarker({
      coordinate: { lat: 35.6804, lng: 139.7690 },
      title: '東京駅',
      snippet: 'サンプル'
    });
  }


  async addMarker(lat: number, lng: number) {
    const vendingCol = collection(this.firestore, 'vendingMachines');
    await addDoc(vendingCol, { lat: lat, lng: lng });
  }

  async addCurrentLocation() {
    const pos = await Geolocation.getCurrentPosition();
     await this.addMarker(pos.coords.latitude, pos.coords.longitude);
  }
}
