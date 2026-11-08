package am.foodme.backend.service;

import am.foodme.backend.dto.DeliveryPriceRequestDto;
import am.foodme.backend.dto.DeliveryPriceResponseDto;
import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.DishRepository;
import am.foodme.backend.repository.OrderRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests: OrderService with mocked repositories. No Spring context, no database.
 * HTTP + persistence behaviour is covered by the integration tests (OrderControllerTest).
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ChefRepository chefRepository;
    @Mock private DishRepository dishRepository;
    @Mock private CustomerRepository customerRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, chefRepository, dishRepository,
                customerRepository, new SimpleMeterRegistry());
    }

    private Chef chef(double deliveryPrice, Double freeDeliveryFrom) {
        Chef chef = new Chef();
        chef.setDeliveryPrice(deliveryPrice);
        chef.setFreeDeliveryFrom(freeDeliveryFrom);
        return chef;
    }

    @Test
    void calculateDeliveryPrice_takeaway_isFree() {
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef(1000.0, 15000.0)));

        DeliveryPriceResponseDto result = orderService.calculateDeliveryPrice(
                new DeliveryPriceRequestDto(1L, 500.0, "TAKEAWAY"));

        assertThat(result.getDeliveryPrice()).isZero();
        assertThat(result.getFreeDeliveryFrom()).isEqualTo(15000.0);
    }

    @Test
    void calculateDeliveryPrice_belowThreshold_chargesChefDeliveryPrice() {
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef(1000.0, 15000.0)));

        DeliveryPriceResponseDto result = orderService.calculateDeliveryPrice(
                new DeliveryPriceRequestDto(1L, 14000.0, "DELIVERY"));

        assertThat(result.getDeliveryPrice()).isEqualTo(1000.0);
    }

    @Test
    void calculateDeliveryPrice_aboveThreshold_isFree() {
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef(1000.0, 15000.0)));

        DeliveryPriceResponseDto result = orderService.calculateDeliveryPrice(
                new DeliveryPriceRequestDto(1L, 20000.0, "DELIVERY"));

        assertThat(result.getDeliveryPrice()).isZero();
    }

    @Test
    void calculateDeliveryPrice_noThreshold_alwaysCharges() {
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef(800.0, null)));

        DeliveryPriceResponseDto result = orderService.calculateDeliveryPrice(
                new DeliveryPriceRequestDto(1L, 1_000_000.0, "DELIVERY"));

        assertThat(result.getDeliveryPrice()).isEqualTo(800.0);
    }

    @Test
    void calculateDeliveryPrice_nullSubtotal_isTreatedAsZero() {
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef(1000.0, 15000.0)));

        DeliveryPriceResponseDto result = orderService.calculateDeliveryPrice(
                new DeliveryPriceRequestDto(1L, null, "DELIVERY"));

        assertThat(result.getDeliveryPrice()).isEqualTo(1000.0);
    }

    @Test
    void calculateDeliveryPrice_unknownChef_throwsNotFound() {
        when(chefRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.calculateDeliveryPrice(
                new DeliveryPriceRequestDto(99L, 100.0, "DELIVERY")))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void createOrder_nonCashPayment_isRejectedBeforeAnyLookup() {
        OrderDto order = new OrderDto();
        order.setPaymentType("CARD");

        assertThatThrownBy(() -> orderService.createOrder(order, "ann@example.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only CASH payment is supported");
        verifyNoInteractions(customerRepository, chefRepository, orderRepository);
    }
}
