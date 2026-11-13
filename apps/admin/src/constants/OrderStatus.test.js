import { describe, expect, it } from 'vitest';
import { OrderStatus, OrderStatusColors, OrderStatusTransitions } from './OrderStatus.jsx';

describe('OrderStatusTransitions', () => {
    it('lets a new order be accepted or rejected', () => {
        expect(OrderStatusTransitions.NEW).toEqual([OrderStatus.ACCEPTED, OrderStatus.REJECTED]);
    });
    it('lets an accepted order be delivered or rejected', () => {
        expect(OrderStatusTransitions.ACCEPTED).toEqual([OrderStatus.DELIVERED, OrderStatus.REJECTED]);
    });
    it('treats delivered and rejected as final', () => {
        expect(OrderStatusTransitions.DELIVERED).toEqual([]);
        expect(OrderStatusTransitions.REJECTED).toEqual([]);
    });
    it('has a colour for every status', () => {
        for (const s of Object.values(OrderStatus)) expect(OrderStatusColors[s]).toBeTruthy();
    });
});
