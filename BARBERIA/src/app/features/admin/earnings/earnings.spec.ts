import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EarningsComponent } from './earnings';

describe('EarningsComponent', () => {
  let component: EarningsComponent;
  let fixture: ComponentFixture<EarningsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EarningsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EarningsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
