import { Component, OnInit, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { GoogleMap } from '@capacitor/google-maps';
import { environment } from '../../environments/environment';
import { Firestore, collectionData, collection, addDoc } from '@angular/fire/firestore';
import { Geolocation } from '@capacitor/geolocation';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { addIcons } from 'ionicons';
import { homeOutline, searchOutline, addCircleOutline, notificationsOutline, personOutline } from 'ionicons/icons';


// Firestore の vendingMachines ドキュメント型
interface VendingMachine {
  lat: number;
  lng: number;
  id?: string;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule,],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MapPage implements OnInit, AfterViewInit {
  map!: GoogleMap;
  private markerIds: string[] = [];
  db!: Firestore;

  constructor() {
    addIcons({ homeOutline, searchOutline, addCircleOutline, notificationsOutline, personOutline });
  }

  ngOnInit() {
    const firebaseConfig = environment.firebase;
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    const vendingCol = collection(this.db, 'vendingMachines');
    const vendingMachines$: Observable<VendingMachine[]> = collectionData(vendingCol, { idField: 'id' })
    .pipe(
      // 型変換
      map((docs) => 
        docs
          .filter((d): d is any => 'lat' in d && 'lng' in d) // lat/lng があるものだけ
          .map(d => ({
            lat: d.lat,
            lng: d.lng,
            id: d.id
          }))
      )
    );

    vendingMachines$.subscribe(async (machines) => {
      if (!this.map) return;

      if (this.markerIds.length > 0) {
        await this.map.removeMarkers(this.markerIds);
        this.markerIds = [];
      }

      for (const m of machines) {
        const markerId = await this.map.addMarker({
          coordinate: { lat: m.lat, lng: m.lng },
          title: '自販機',
        });
        this.markerIds.push(markerId);
      }
    });
  }

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

    // サンプルマーカー
    await this.map.addMarker({
      coordinate: { lat: 35.6804, lng: 139.7690 },
      title: '東京駅',
      snippet: 'サンプル',
    });
  }

  // Firestore にマーカー追加
  async addMarker(lat: number, lng: number) {
    const vendingCol = collection(this.db, 'vendingMachines');
    await addDoc(vendingCol, { lat, lng });
  }

  // 現在地を取得してマーカー追加
  async addCurrentLocation() {
    const pos = await Geolocation.getCurrentPosition();
    await this.addMarker(pos.coords.latitude, pos.coords.longitude);
  }

  hello() {
     alert('hello');       //test
  }
}