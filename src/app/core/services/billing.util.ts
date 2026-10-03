import { PublicRestaurant } from '../models/public-menu.model';

export interface BillBreakup {
  subtotal: number;
  serviceChargeAmount: number;
  gstAmount: number;
  total: number;
}

export function computeBill(subtotal: number, restaurant: Pick<PublicRestaurant,
  'isServiceChargeEnabled' | 'serviceChargePercentage' | 'isGstEnabled' | 'gstPercentage'>, skipServiceCharge = false): BillBreakup {
  const serviceChargeAmount = restaurant.isServiceChargeEnabled && !skipServiceCharge
    ? round2(subtotal * restaurant.serviceChargePercentage / 100)
    : 0;

  const gstAmount = restaurant.isGstEnabled
    ? round2((subtotal + serviceChargeAmount) * restaurant.gstPercentage / 100)
    : 0;

  const total = subtotal + serviceChargeAmount + gstAmount;

  return { subtotal, serviceChargeAmount, gstAmount, total };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
