import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Helmet } from './helmet';

describe('Helmet', () => {
  let component: Helmet;
  let fixture: ComponentFixture<Helmet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Helmet],
    }).compileComponents();

    fixture = TestBed.createComponent(Helmet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
