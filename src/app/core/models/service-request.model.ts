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
  emoji: string;
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
    emoji: '🔔',
    buttonLabel: 'Call waiter',
    sentMessage: 'Waiter has been called. Someone will be with you shortly.',
    adminLabel: 'Calling the waiter',
    adminText: (t) => `Table ${t} is calling the waiter`
  },
  {
    type: 'Water',
    emoji: '💧',
    buttonLabel: 'Water',
    sentMessage: 'Water is on its way.',
    adminLabel: 'Needs water',
    adminText: (t) => `Table ${t} needs water`
  },
  {
    type: 'Bill',
    emoji: '🧾',
    buttonLabel: 'Bill',
    sentMessage: 'We will bring your bill shortly.',
    adminLabel: 'Wants the bill',
    adminText: (t) => `Table ${t} is asking for the bill`
  }
];

export function serviceRequestMeta(type: ServiceRequestType): ServiceRequestMeta {
  return SERVICE_REQUESTS.find((m) => m.type === type) ?? SERVICE_REQUESTS[0];
}
