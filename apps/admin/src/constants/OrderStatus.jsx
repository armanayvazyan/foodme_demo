const OrderStatus = {
    NEW: 'NEW',
    ACCEPTED: 'ACCEPTED',
    DELIVERED: 'DELIVERED',
    REJECTED: 'REJECTED',
    // FOODQA-2: set only by the customer, while the order is NEW.
    CANCELLED: 'CANCELLED',
};

const OrderStatusColors = {
    [OrderStatus.NEW]: 'info',
    [OrderStatus.ACCEPTED]: 'warning',
    [OrderStatus.DELIVERED]: 'success',
    [OrderStatus.REJECTED]: 'error',
    // FOODQA-2: neutral grey, deliberately not the red REJECTED style.
    [OrderStatus.CANCELLED]: 'default',
};

// Allowed forward transitions per current status
const OrderStatusTransitions = {
    [OrderStatus.NEW]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
    [OrderStatus.ACCEPTED]: [OrderStatus.DELIVERED, OrderStatus.REJECTED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.REJECTED]: [],
    // FOODQA-2: terminal; the backend refuses any admin transition out of it.
    [OrderStatus.CANCELLED]: [],
};

export { OrderStatus, OrderStatusColors, OrderStatusTransitions };
