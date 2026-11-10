package am.foodme.backend.service;

import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Order;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.DishRepository;
import am.foodme.backend.repository.OrderRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** FOODQA-2: unit tests for OrderService.cancelOrder (no Spring context). */
class OrderServiceCancelTest {

    private static final String EMAIL = "ann@example.com";
    private static final String NUMBER = "FM-TEST-1";
    private static final long CUSTOMER_ID = 7L;
    private static final long ORDER_ID = 42L;

    private OrderRepository orderRepository;
    private CustomerRepository customerRepository;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        customerRepository = mock(CustomerRepository.class);
        orderService = new OrderService(orderRepository, mock(ChefRepository.class),
                mock(DishRepository.class), customerRepository, mock(MeterRegistry.class));
    }

    private Customer customer() {
        Customer c = new Customer();
        c.setId(CUSTOMER_ID);
        c.setEmail(EMAIL);
        return c;
    }

    private Order order(String status) {
        Order o = new Order();
        o.setId(ORDER_ID);
        o.setNumber(NUMBER);
        o.setStatus(status);
        return o;
    }

    // U-C1
    @Test
    void cancelOrder_ownerAndNew_transitionsToCancelled() {
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer()));
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order("NEW")));
        when(orderRepository.transitionStatus(ORDER_ID, "NEW", "CANCELLED")).thenReturn(1);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("CANCELLED")));

        OrderDto result = orderService.cancelOrder(NUMBER, EMAIL);

        assertEquals("CANCELLED", result.getStatus());
        assertEquals(NUMBER, result.getNumber());
        verify(orderRepository, times(1)).transitionStatus(ORDER_ID, "NEW", "CANCELLED");
    }

    // U-C2
    @Test
    void cancelOrder_orderNotOwnedOrMissing_notFound() {
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer()));
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class, () -> orderService.cancelOrder(NUMBER, EMAIL));

        assertEquals("Order " + NUMBER + " not found", ex.getMessage());
        verify(orderRepository, never()).transitionStatus(anyLong(), anyString(), anyString());
    }

    // U-C3
    @Test
    void cancelOrder_unknownCustomer_notFound() {
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class, () -> orderService.cancelOrder(NUMBER, EMAIL));

        assertEquals("Customer not found", ex.getMessage());
        verify(orderRepository, never()).findByNumberAndCustomerId(anyString(), any());
    }

    // U-C4
    @ParameterizedTest
    @ValueSource(strings = {"ACCEPTED", "DELIVERED", "REJECTED", "CANCELLED"})
    void cancelOrder_statusNotNew_badRequestWithoutUpdate(String status) {
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer()));
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order(status)));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> orderService.cancelOrder(NUMBER, EMAIL));

        assertEquals("Cannot cancel order in status " + status, ex.getMessage());
        verify(orderRepository, never()).transitionStatus(anyLong(), anyString(), anyString());
    }

    // U-C5
    @Test
    void cancelOrder_conditionalUpdateChangesNoRows_badRequest() {
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer()));
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order("NEW")));
        when(orderRepository.transitionStatus(ORDER_ID, "NEW", "CANCELLED")).thenReturn(0);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> orderService.cancelOrder(NUMBER, EMAIL));

        assertEquals("Order status changed concurrently; reload and retry", ex.getMessage());
        verify(orderRepository, never()).findById(anyLong());
    }

    // U-C6
    @Test
    void cancelOrder_emailIsTrimmedAndLowercased() {
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer()));
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order("NEW")));
        when(orderRepository.transitionStatus(ORDER_ID, "NEW", "CANCELLED")).thenReturn(1);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order("CANCELLED")));

        OrderDto result = orderService.cancelOrder(NUMBER, "  Ann@Example.COM ");

        assertEquals("CANCELLED", result.getStatus());
        verify(customerRepository).findByEmail(EMAIL);
    }
}
