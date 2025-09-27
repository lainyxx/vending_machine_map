import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddMarkerPage } from './add-marker.page';

describe('AddMarkerPage', () => {
  let component: AddMarkerPage;
  let fixture: ComponentFixture<AddMarkerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AddMarkerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
