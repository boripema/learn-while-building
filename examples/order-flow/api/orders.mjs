import { validateOrder } from '../services/order.mjs';
import { saveOrder } from '../db/orders.mjs';

export async function postOrder(input) {
  const order = validateOrder(input);
  return await saveOrder(order);
}
