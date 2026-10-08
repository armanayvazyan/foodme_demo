import { describe, expect, it } from 'vitest';
import { OrderStatus, OrderStatusColors, OrderStatusTransitions } from './OrderStatus.jsx';

describe('OrderStatusTransitions', () => {
    it('lets a new order be accepted or rejected', () => {
        expect(OrderStatusTransitions[OrderStatus.NEW]).toEqual([OrderStatus.ACCEPTED, OrderStatus.REJECTED]);
    });

    it('lets an accepted order be delivered or rejected', () => {
        expect(OrderStatusTransitions[OrderStatus.ACCEPTED]).toEqual([OrderStatus.DELIVERED, OrderStatus.REJECTED]);
    });

    it('treats delivered and rejected as final', () => {
        expect(OrderStatusTransitions[OrderStatus.DELIVERED]).toEqual([]);
        expect(OrderStatusTransitions[OrderStatus.REJECTED]).toEqual([]);
    });
});

describe('OrderStatusColors', () => {
    it('has a color for every status', () => {
        for (const status of Object.values(OrderStatus)) {
            expect(OrderStatusColors[status]).toBeTruthy();
        }
    });
});
