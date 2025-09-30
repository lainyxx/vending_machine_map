import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { getAuth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonButtons, IonIcon, IonButton, IonSelect, IonSelectOption, IonList } from '@ionic/angular/standalone';
import { getFirestore } from 'firebase/firestore';
import { Location } from '@angular/common';

@Component({
  selector: 'app-add-marker',
  templateUrl: './add-marker.page.html',
  styleUrls: ['./add-marker.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonButton,
    IonList,
    IonSelect,
    IonButtons, 
    IonIcon,
  ]
})
export class AddMarkerPage {
  lat!: number;
  lng!: number;
  minPrice: string | null = null;
  maxPrice: string | null = null;
  manufacturers: string[] = [];
  db!: Firestore;
  errorMessage: string | null = null; // ← エラーメッセージ保持用

  constructor(
    private router: Router,
    private _location: Location,
  ) {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras.state as { lat: number; lng: number };
    if (state) {
      this.lat = state.lat;
      this.lng = state.lng;
    }
  }

  async save() {
    this.errorMessage = null; // 初期化

    // --- バリデーション ---
    if (!this.minPrice || !this.maxPrice || this.manufacturers.length === 0) {
      this.errorMessage = 'すべての項目を選択してください。';
      return;
    }

    const min = Number(this.minPrice);
    const max = Number(this.maxPrice);

    if (min > max) {
      this.errorMessage = '最低価格は最高価格を超えることはできません。';
      return;
    }

    // --- 保存処理 ---
    const auth = getAuth();
    const user = auth.currentUser;
    console.log(this.manufacturers,this.minPrice,this.maxPrice);
    this.db = getFirestore();
    const vendingCol = collection(this.db, 'vendingMachines');
    await addDoc(vendingCol, {
      lat: this.lat,
      lng: this.lng,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      manufacturers: this.manufacturers,
      userId: user?.uid ?? null,
      createdAt: new Date()
    });

    // 保存後にマップページへ戻る
    this._location.back();
  }

  goBack() {
    this._location.back();
  }
}
