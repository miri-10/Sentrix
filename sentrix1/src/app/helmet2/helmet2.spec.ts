import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Helmet2 } from './helmet2';

describe('Helmet2', () => {
  let component: Helmet2;
  let fixture: ComponentFixture<Helmet2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Helmet2],
    }).compileComponents();

    fixture = TestBed.createComponent(Helmet2);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
