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

/**
 * The rates an already placed order was charged at, worked out from its saved amounts. The restaurant's settings may
 * have changed since, so its current rates could show a % that does not match the amounts.
 * Rounded to the nearest 0.5 (GST and service charge rates are whole or half percents).
 */
export function ratesOf(bill: BillBreakup): { gstPercentage: number; serviceChargePercentage: number } {
  const half = (value: number) => Math.round(value * 2) / 2;
  const gstBase = bill.subtotal + bill.serviceChargeAmount;
  return {
    gstPercentage: gstBase > 0 && bill.gstAmount > 0 ? half((bill.gstAmount / gstBase) * 100) : 0,
    serviceChargePercentage: bill.subtotal > 0 && bill.serviceChargeAmount > 0 ? half((bill.serviceChargeAmount / bill.subtotal) * 100) : 0
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
