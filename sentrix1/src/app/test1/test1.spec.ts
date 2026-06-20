import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Test1 } from './test1';

describe('Test1', () => {
  let component: Test1;
  let fixture: ComponentFixture<Test1>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Test1],
    }).compileComponents();

    fixture = TestBed.createComponent(Test1);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
