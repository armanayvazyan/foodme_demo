package am.foodme.backend.service;

import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Order;
import am.foodme.backend.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** FOODQA-2: unit tests for the conditional admin status update (no Spring context). */
class AdminOrderServiceTransitionTest {

    private static final long ORDER_ID = 42L;

    private OrderRepository orderRepository;
    private AdminOrderService adminOrderService;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        adminOrderService = new AdminOrderService(orderRepository);
    }

    private Order order(String status, String rejectReason) {
        Order o = new Order();
        o.setId(ORDER_ID);
        o.setNumber("FM-TEST-2");
        o.setStatus(status);
        o.setRejectReason(rejectReason);
        return o;
    }

    // U-A1
    @Test
    void updateStatus_newToAccepted_usesConditionalUpdateExpectingNew() {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(order("NEW", null)))
                .thenReturn(Optional.of(order("ACCEPTED", null)));
        when(orderRepository.transitionStatus(ORDER_ID, "NEW", "ACCEPTED")).thenReturn(1);

        OrderDto result = adminOrderService.updateStatus(ORDER_ID, "ACCEPTED", null);

        assertEquals("ACCEPTED", result.getStatus());
        verify(orderRepository).transitionStatus(ORDER_ID, "NEW", "ACCEPTED");
        verify(orderRepository, never()).transitionStatusWithRejectReason(anyLong(), anyString(), anyString(), any());
    }

    // U-A2
    @ParameterizedTest
    @CsvSource({"NEW", "ACCEPTED"})
    void updateStatus_toRejected_setsStatusAndReasonInOneConditionalUpdate(String from) {
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(order(from, null)))
                .thenReturn(Optional.of(order("REJECTED", "Out of stock")));
        when(orderRepository.transitionStatusWithRejectReason(ORDER_ID, from, "REJECTED", "Out of stock")).thenReturn(1);

        OrderDto result = adminOrderService.updateStatus(ORDER_ID, "REJECTED", "Out of stock");

        assertEquals("REJECTED", result.getStatus());
        assertEquals("Out of stock", result.getRejectReason());
        verify(orderRepository).transitionStatusWithRejectReason(ORDER_ID, from, "REJECTED", "Out of stock");
        verify(orderRepository, never()).transitionStatus(anyLong(), anyString(), anyString());
    }

    // U-A3
    @ParameterizedTest
    @CsvSource({
            "NEW, CANCELLED",
            "ACCEPTED, CANCELLED",
            "CANCELLED, ACCEPTED",
            "CANCELLED, NEW",
            "CANCELLED, REJECTED",
            "CANCELLED, DELIVERED"
    })
    void updateStatus_transitionIntoOrOutOfCancelled_rejectedWithoutWrite(String from, String to) {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(from, null)));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> adminOrderService.updateStatus(ORDER_ID, to, null));

        assertEquals("Cannot transition order from " + from + " to " + to, ex.getMessage());
        verify(orderRepository, never()).transitionStatus(anyLong(), anyString(), anyString());
        verify(orderRepository, never()).transitionStatusWithRejectReason(anyLong(), anyString(), anyString(), any());
    }

    // U-A4
    @Test
    void updateStatus_conditionalUpdateChangesNoRows_badRequest() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("NEW", null)));
        when(orderRepository.transitionStatus(ORDER_ID, "NEW", "ACCEPTED")).thenReturn(0);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> adminOrderService.updateStatus(ORDER_ID, "ACCEPTED", null));

        assertEquals("Order status changed concurrently; reload and retry", ex.getMessage());
    }

    // U-A5
    @Test
    void updateStatus_unknownOrder_notFound() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class,
                () -> adminOrderService.updateStatus(ORDER_ID, "ACCEPTED", null));

        assertEquals("Order " + ORDER_ID + " not found", ex.getMessage());
    }
}
