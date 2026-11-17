export function validateOrder(input) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error('Quantity must be a positive integer');
  }
  return { quantity: input.quantity };
}
