import { AppIconName } from '../../shared/app-icon/app-icon';

export type ServiceRequestType = 'CallWaiter' | 'Water' | 'Bill';

export interface ServiceRequest {
  id: string;
  tableNumber: string;
  type: ServiceRequestType;
  status: 'Pending' | 'Done';
  createdAt: string;
}

export interface ServiceRequestMeta {
  type: ServiceRequestType;
  /** Shown with <app-icon> (themed SVG, not an emoji). */
  icon: AppIconName;
  /** Button label on the customer menu. */
  buttonLabel: string;
  /** Shown to the customer once the request is sent. */
  sentMessage: string;
  /** Short admin-facing label, e.g. "Calling the waiter". */
  adminLabel: string;
  /** Admin-facing sentence, e.g. "Table 3 is calling the waiter" (also spoken aloud). */
  adminText: (tableNumber: string) => string;
}

export const SERVICE_REQUESTS: ServiceRequestMeta[] = [
  {
    type: 'CallWaiter',
    icon: 'bell',
    buttonLabel: 'Call waiter',
    sentMessage: 'A waiter is on the way to your table. Please give us a moment.',
    adminLabel: 'Calling the waiter',
    adminText: (t) => `Table ${t} is calling the waiter`
  },
  {
    type: 'Water',
    icon: 'water',
    buttonLabel: 'Water',
    sentMessage: 'Fresh water is coming to your table.',
    adminLabel: 'Needs water',
    adminText: (t) => `Table ${t} needs water`
  },
  {
    type: 'Bill',
    icon: 'receipt',
    buttonLabel: 'Bill',
    sentMessage: 'Your bill is being prepared. We will bring it to your table shortly.',
    adminLabel: 'Wants the bill',
    adminText: (t) => `Table ${t} is asking for the bill`
  }
];

export function serviceRequestMeta(type: ServiceRequestType): ServiceRequestMeta {
  return SERVICE_REQUESTS.find((m) => m.type === type) ?? SERVICE_REQUESTS[0];
}
