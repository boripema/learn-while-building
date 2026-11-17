import { postOrder } from '../api/orders.mjs';

export async function submitOrder(quantity) {
  return await postOrder({ quantity });
}
