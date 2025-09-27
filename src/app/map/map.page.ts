import { Component, OnInit, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Renderer2  } from '@angular/core';
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
  isAddMarkerMode = false; // マーカー追加モード
  currentLocationMarkerId?: string;
  watchId?: string;
  curLat?: number;
  curLng?: number;

  constructor(private renderer: Renderer2) {
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

    // マップクリックリスナー
    this.map.setOnMapClickListener(async (event) => {
      if (!this.isAddMarkerMode) return;

      const lat = event.latitude;
      const lng = event.longitude;

      const markerId = await this.map.addMarker({
        coordinate: { lat, lng },
        title: '新しいマーカー',
      });
      this.markerIds.push(markerId);

      // Firestore に保存
      await this.addMarker(lat, lng);

      // 追加後にモードを自動OFFにしたい場合は以下
      // this.isAddMarkerMode = false;
    });
    // マップ作成後に現在地監視開始
    this.startTrackingCurrentLocation();
  }

  // 画面離脱時
  ngOnDestroy() {
    this.stopTrackingCurrentLocation();
  }

  // Firestore にマーカー追加
  async addMarker(lat: number, lng: number) {
    const vendingCol = collection(this.db, 'vendingMachines');
    await addDoc(vendingCol, { lat, lng });
  }

  async startTrackingCurrentLocation() {
    // すでに監視中なら停止
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
    }

    this.watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      async (position, err) => {
        if (err) {
          console.error('位置情報取得エラー', err);
          return;
        }
        if (!position) return;

        this.curLat = position.coords.latitude;
        this.curLng = position.coords.longitude;

        // 既存マーカーがあれば削除
        if (this.currentLocationMarkerId) {
          await this.map.removeMarker(this.currentLocationMarkerId);
        }

        // 現在地マーカーを追加
        this.currentLocationMarkerId = await this.map.addMarker({
          coordinate: { lat: this.curLat, lng: this.curLng },
          title: '現在地',
          snippet: 'ここにいます',
        });
      }
    );
  }

  stopTrackingCurrentLocation() {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = undefined;
    }
  }

  async addMarkerMode() {
    this.isAddMarkerMode = true;
    alert('マーカー追加モード ON');
  }

  viewMode() {
    this.isAddMarkerMode = false;
    alert('マーカー追加モード OFF');
    // マップ中心を更新
    if (this.curLat && this.curLng) {
      this.map.setCamera({ coordinate: { lat: this.curLat, lng: this.curLng }, zoom: 15 });
    }
  }


  // ボタンを押したときのエフェクト
  rippleEffect(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;

    const ripple = this.renderer.createElement('span');
    this.renderer.addClass(ripple, 'ripple');

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;

    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

    this.renderer.appendChild(button, ripple);

    setTimeout(() => {
      this.renderer.removeChild(button, ripple);
    }, 600);
  }
}