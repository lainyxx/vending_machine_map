import { Component, OnInit, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Renderer2  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { GoogleMap } from '@capacitor/google-maps';
import { environment } from '../../environments/environment';
import { Firestore, collectionData, collection, addDoc } from '@angular/fire/firestore';
import { Geolocation } from '@capacitor/geolocation';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { getFirestore } from 'firebase/firestore';
import { addIcons } from 'ionicons';
import { locationOutline, searchOutline, addCircleOutline, notificationsOutline, personOutline } from 'ionicons/icons';
import { Auth, signInAnonymously, User, getAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Toast } from '@capacitor/toast';


// Firestore の vendingMachines ドキュメント型
interface VendingMachine {
  lat: number;
  lng: number;
  id?: string;
  minPrice: string;
  maxPrice: string;
  manufacturers: string[];
  createdAt: Date;
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
  user: User | null = null;
  private sub?: Subscription;
  private auth?: Auth;

  constructor(
    private renderer: Renderer2,
    private router: Router,
    private toastController: ToastController,
  ) {
    addIcons({ locationOutline, searchOutline, addCircleOutline, notificationsOutline, personOutline });
  }

  async ngOnInit() {
    // 匿名ログイン
    this.auth = getAuth()
    try {
      const result = await signInAnonymously(this.auth);
      this.user = result.user;
      console.log('匿名ログイン成功:', this.user.uid);
    } catch (err) {
      console.error('匿名ログイン失敗:', err);
    }

    // データベース接続
    this.db = getFirestore();
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
            id: d.id,
            minPrice: d.minPrice,
            maxPrice: d.maxPrice,
            manufacturers: d.manufacturers,
            createdAt: d.createdAt,
          }))
      )
    );

    this.sub = vendingMachines$.subscribe(async (machines) => {
      if (!this.map) return;

      if (this.markerIds.length > 0) {
        await this.map.removeMarkers(this.markerIds);
        this.markerIds = [];
      }

      for (const m of machines) {
        const markerId = await this.map.addMarker({
          coordinate: { lat: m.lat, lng: m.lng },
          title: '自販機',
          snippet: `価格: ${m.minPrice}〜${m.maxPrice}円 メーカー: ${m.manufacturers.join(', ')}`,
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

    // マップ作成後に現在地監視開始
    this.startTrackingCurrentLocation();

    // マップクリックリスナー
    this.map.setOnMapClickListener(async (event) => {
      if (!this.isAddMarkerMode) return;
      // 追加モードをOFF
      this.isAddMarkerMode = false;

      const lat = event.latitude;
      const lng = event.longitude;

      // 座標を持って詳細入力ページへ遷移
      this.router.navigate(['/add-marker'], {
        state: { lat, lng }
      });
    });
  }

  // 画面離脱時
  ngOnDestroy() {
  this.stopTrackingCurrentLocation();
  this.sub?.unsubscribe();
}

  // Firestore にマーカー追加
async addMarkerFirestore(lat: number, lng: number) {
  if (!this.user) {
    console.warn('ユーザー未ログインのため保存できません');
    return;
  }

  const vendingCol = collection(this.db, 'vendingMachines');
  await addDoc(vendingCol, {
    lat,
    lng,
    userId: this.user.uid, // ← 匿名ユーザーのUIDを保存
    createdAt: new Date()
  });
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
      }
    );
  }

  stopTrackingCurrentLocation() {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = undefined;
    }
  }

  async currentLocation() {
    // マップ中心を更新
    if (this.curLat && this.curLng) {
      this.map.setCamera({ coordinate: { lat: this.curLat, lng: this.curLng }, zoom: 15 });
      // トースト表示
      await Toast.show({
        text: '現在地に移動しました',
        duration: 'short'
      });
    }
  }

  toggleAddMarkerMode() {
    this.isAddMarkerMode = !this.isAddMarkerMode;
  }

  // キャンセルボタン押下時
  cancelAddMarkerMode() {
    this.isAddMarkerMode = false;
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