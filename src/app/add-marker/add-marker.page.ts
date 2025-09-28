import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { getAuth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonButton, IonSelect, IonSelectOption, IonList } from '@ionic/angular/standalone';
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
  ]
})
export class AddMarkerPage {
  lat!: number;
  lng!: number;
  minPrice: string | null = null;
  maxPrice: string | null = null;
  manufacturers: string[] = [];
  db!: Firestore;

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


  test() {
    console.log(this.manufacturers,this.minPrice,this.maxPrice);
  }
}
