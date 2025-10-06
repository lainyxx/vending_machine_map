import { Component, OnInit, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA, Renderer2  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonSelect, IonSelectOption} from '@ionic/angular/standalone';
import { GoogleMap } from '@capacitor/google-maps';
import { environment } from '../../environments/environment';
import { Firestore, collectionData, collection, addDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { Geolocation } from '@capacitor/geolocation';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { getFirestore } from 'firebase/firestore';
import { addIcons } from 'ionicons';
import { locationOutline, searchOutline, addCircleOutline, notificationsOutline, personOutline } from 'ionicons/icons';
import { Auth, signInAnonymously, User, getAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Toast } from '@capacitor/toast';


// Google Maps JS API 用（グローバルに読み込まれる）
declare const google: any;

// Firestore の vendingMachines ドキュメント型
interface VendingMachine {
  lat: number;
  lng: number;
  id?: string;
  minPrice: string;
  maxPrice: string;
  manufacturers: string[];
  createdAt: Date;
  userId: string;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, 
            IonSelect, IonSelectOption,],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MapPage implements OnInit {
  // Google Maps JS API の Map インスタンス
  map: any;

  // Firestore / マーカー管理
  private markerIds: string[] = []; // firestore の id を保持
  db!: Firestore;
  private markerMap: Record<string, google.maps.Marker> = {}; // firestoreId -> Marker

  // 画面状態
  isAddMarkerMode = false; // マーカー追加モード
  showFilter = false; // フィルター表示フラグ
  mapError = false; // マップ読み込みエラーフラグ

  // 位置情報
  currentLocationMarker?: google.maps.Marker;
  watchId?: string;
  curLat?: number;
  curLng?: number;

  // 認証・データ
  user: User | null = null;
  private sub?: Subscription;
  private auth?: Auth;
  private allMachines: VendingMachine[] = []; // 全データ保持
  currentMachines: VendingMachine[] = [];
  selectedMachine: VendingMachine | undefined = undefined;
  isMine = false;

  // UI補助
  selectedPrice?: number;
  selectedManufacturers: string[] = [];
  priceOptions: number[] = Array.from({ length: 10 }, (_, i) => (i + 1) * 10);


  constructor(
    private renderer: Renderer2,
    private router: Router,
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
            userId: d.userId,
          }))
      )
    );
    // マーカーを購読して表示
    this.sub = vendingMachines$.subscribe(async (machines) => {
      this.allMachines = machines;
      this.applyFilter();
    });
  }

  async ngAfterViewInit() {
    // map 要素がレンダリングされていないケースに備えて少し待つ
    await new Promise((res) => setTimeout(res, 120));

    // Google Maps JS API のスクリプトを動的に読み込む
    try {
      await this.loadGoogleMapsScript();
    } catch (err) {
      console.error('Google Maps script load failed', err);
      this.mapError = true;
      return;
    }

    // Map 作成（既に作成済みなら再作成しない）
    if (!this.map) {
      try {
        const mapEl = document.getElementById('map') as HTMLElement;
        this.map = new google.maps.Map(mapEl, {
          center: { lat: 35.6804, lng: 139.7690 }, // 東京駅
          zoom: 12,
          fullscreenControl: false,
        });

        // マップクリックリスナー（追加モード時に座標を取得して遷移）
        this.map.addListener('click', (e: any) => {
          if (!this.isAddMarkerMode) return;
          this.isAddMarkerMode = false;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          // 詳細入力ページへ遷移（座標を state で渡す）
          this.router.navigate(['/add-marker'], {
            state: { lat, lng }
          });
        });

        // マップが表示された直後、描画ズレ対応でリサイズトリガー
        setTimeout(() => {
          try {
            google.maps.event.trigger(this.map, 'resize');
          } catch (e) { /* ignore */ }
        }, 200);

      } catch (err) {
        console.error('Google Map init error', err);
        this.mapError = true;
        return;
      }
    }

    // マップ作成後に現在地監視開始
    this.startTrackingCurrentLocation();
  }

// --- ライフサイクル: 破棄時に監視解除等 ---
  ngOnDestroy() {
    this.stopTrackingCurrentLocation();
    this.sub?.unsubscribe();

    // Map 上の全マーカーを解除
    for (const fid of Object.keys(this.markerMap)) {
      try {
        this.markerMap[fid].setMap(null);
      } catch (e) { /* ignore */ }
    }
    this.markerMap = {};
    this.markerIds = [];
  }

  // --- Google Maps JS を動的に読み込むヘルパー ---
  private loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google && (window as any).google.maps) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }
  

  // --- マーカー削除（UI + Firestore） ---
  async deleteMarker(machine: VendingMachine) {
    if (!machine.id) return;
    this.selectedMachine = undefined;

    // Firestore 側を削除
    await this.deleteMarkerFirestore(machine.id);

    // 地図上のマーカーを削除
    const marker = this.markerMap[machine.id];
    if (marker) {
      marker.setMap(null);
      delete this.markerMap[machine.id];
      const idx = this.markerIds.indexOf(machine.id);
      if (idx >= 0) this.markerIds.splice(idx, 1);
    }
  }

  async requestDelete(machine: VendingMachine) {
    if (!this.user) {
      console.warn('ログインしていません');
      return;
    }
    if (!machine.id) return;
    
    this.selectedMachine = undefined;

    const reqCol = collection(this.db, 'deleteRequests');

    // 今日の0:00を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- 二重申請チェック ---
    const dupQ = query(
      reqCol,
      where('machineId', '==', machine.id),
      where('requestUserId', '==', this.user.uid)
    );
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty) {
      await Toast.show({ text: 'すでに削除申請済みです', duration: 'short' });
      return;
    }

    // --- 1日の上限チェック ---
    const dailyLimit = 5; // 例：1日5件まで
    const dailyQ = query(
      reqCol,
      where('requestUserId', '==', this.user.uid),
      where('createdAt', '>=', today)
    );
    const dailySnap = await getDocs(dailyQ);
    if (dailySnap.size >= dailyLimit) {
      await Toast.show({
        text: `削除申請は1日${dailyLimit}件までです`,
        duration: 'short',
      });
      return;
    }

    // --- 登録 ---
    await addDoc(reqCol, {
      machineId: machine.id,
      requestUserId: this.user.uid,
      createdAt: new Date(),
    });

    await Toast.show({
      text: '削除申請を送信しました',
      duration: 'short',
    });

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

  // Firestore のマーカー削除
  async deleteMarkerFirestore(id: string) {
    if (!this.user) {
      console.warn('ユーザー未ログインのため削除できません');
      return;
    }

    const vendingCol = collection(this.db, 'vendingMachines');
    await deleteDoc(doc(vendingCol, id));
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


  applyFilter() {
    if (!this.map) return;

     // 既存マーカーをすべて削除
    for (const fid of this.markerIds) {
      const m = this.markerMap[fid];
      if (m) {
        m.setMap(null);
        delete this.markerMap[fid];
      }
    }
    this.markerIds = [];

    // フィルタ条件にマッチする自販機のみ選択
    const filtered = this.allMachines.filter(m => {
      const priceOk = (!this.selectedPrice || Number(m.minPrice) <= this.selectedPrice);
      const manufacturerOk =
        this.selectedManufacturers.length === 0 ||
        (m.manufacturers || []).some(man => this.selectedManufacturers.includes(man));
      return priceOk && manufacturerOk;
    });

    this.currentMachines = filtered;

    // マーカーを順番に追加
    for (const m of filtered) {
      if (!m.id) continue;
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: this.map,
        title: `自販機: ${m.id}`,
      });

      // マーカークリックで詳細表示（closure により machine を参照）
      marker.addListener('click', () => {
        const isMine = m.userId === this.user?.uid;
        this.showMarkerInfo(m, isMine);
      });

      this.markerIds.push(m.id);
      this.markerMap[m.id] = marker;
    }

    this.showFilter = false; // 適用後は閉じる
  }

  showMarkerInfo(machine: VendingMachine, isMine: boolean) {
    this.selectedMachine = machine;
    this.isMine = isMine;
  }

  closeInfo() {
    this.selectedMachine = undefined;
  }

  // 選択中の値を初期化する
  clearFilters() {
    this.selectedPrice = undefined;
    this.selectedManufacturers = [];
  }

  // --- 現在地へ移動（ユーザ操作） ---
  async currentLocation() {
    if (this.curLat && this.curLng && this.map) {
      this.map.panTo({ lat: this.curLat, lng: this.curLng });
      this.map?.setZoom(15);
      await Toast.show({ text: '現在地に移動しました', duration: 'short' });
    }
  }

  async toggleAddMarkerMode() {
    this.showFilter = false;
    this.selectedMachine = undefined;
    // 1日あたりの自販機登録を制限
    if (!this.isAddMarkerMode) {
      if (!this.user) {
        console.warn('ユーザー未ログインのため保存できません');
        return;
      }

      const vendingCol = collection(this.db, 'vendingMachines');

      // 今日の0:00を取得
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 今日作成した自販機の数を取得
      const q = query(
        vendingCol,
        where('userId', '==', this.user.uid),
        where('createdAt', '>=', today)
      );

      const snapshot = await getDocs(q);
      const todayCount = snapshot.size;

      const limitPerDay = 5; // ← 登録上限（例）

      if (todayCount >= limitPerDay) {
        console.warn('1日の登録上限に達しました');
        await Toast.show({
          text: `一日の登録上限（${limitPerDay}件）に達しました`,
          duration: 'short',
        });
        return;
      }
    }
    // マーカ作成モード切り替え
    this.isAddMarkerMode = !this.isAddMarkerMode;
  }

  // キャンセルボタン押下時
  cancelAddMarkerMode() {
    this.isAddMarkerMode = false;
  }

  toggleFilter() {
    this.isAddMarkerMode = false;
    this.selectedMachine = undefined;
    this.showFilter = !this.showFilter;
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