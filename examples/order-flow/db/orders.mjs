// Teaching example: memory only; restarting the process clears all orders.
const orders = new Map();

export async function saveOrder(order) {
  const id = orders.size + 1;
  orders.set(id, { ...order, id });
  return orders.get(id);
}
