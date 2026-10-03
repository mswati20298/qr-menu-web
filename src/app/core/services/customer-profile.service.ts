import { Injectable, computed, signal } from '@angular/core';

export interface CustomerProfile {
  name: string;
  phone: string;
}

const STORAGE_KEY = 'qrmenu_customer_profile';

@Injectable({ providedIn: 'root' })
export class CustomerProfileService {
  private readonly profile = signal<CustomerProfile>(this.readFromStorage());

  readonly current = computed(() => this.profile());

  save(profile: CustomerProfile): void {
    this.profile.set(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // localStorage unavailable — profile stays in-memory for this session.
    }
  }

  private readFromStorage(): CustomerProfile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CustomerProfile) : { name: '', phone: '' };
    } catch {
      return { name: '', phone: '' };
    }
  }
}
