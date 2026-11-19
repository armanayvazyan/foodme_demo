package am.foodme.backend.service;

import am.foodme.backend.dto.AddressDto;
import am.foodme.backend.dto.CreateOrderDishDto;
import am.foodme.backend.dto.DeliveryPriceRequestDto;
import am.foodme.backend.dto.DeliveryPriceResponseDto;
import am.foodme.backend.dto.OrderCreateResponseDto;
import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.dto.OrderListResponseDto;
import am.foodme.backend.dto.PromoApplyRequestDto;
import am.foodme.backend.dto.PromoApplyResponseDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.ConflictException;
import am.foodme.backend.exceptionHandler.ForbiddenException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Address;
import am.foodme.backend.model.Chef;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Dish;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderDish;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.DishRepository;
import am.foodme.backend.repository.OrderRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static net.logstash.logback.argument.StructuredArguments.kv;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final ChefRepository chefRepository;
    private final DishRepository dishRepository;
    private final CustomerRepository customerRepository;
    private final MeterRegistry meterRegistry;
    private final PromoService promoService;

    public OrderService(OrderRepository orderRepository, ChefRepository chefRepository,
                         DishRepository dishRepository, CustomerRepository customerRepository,
                         MeterRegistry meterRegistry, PromoService promoService) {
        this.orderRepository = orderRepository;
        this.chefRepository = chefRepository;
        this.dishRepository = dishRepository;
        this.customerRepository = customerRepository;
        this.meterRegistry = meterRegistry;
        this.promoService = promoService;
    }

    public DeliveryPriceResponseDto calculateDeliveryPrice(DeliveryPriceRequestDto request) {
        Chef chef = chefRepository.findById(request.getChefId())
                .orElseThrow(() -> new NotFoundException("Chef " + request.getChefId() + " not found"));

        if ("TAKEAWAY".equals(request.getDeliveryMethod())) {
            return new DeliveryPriceResponseDto(0.0, chef.getFreeDeliveryFrom());
        }

        double subtotal = request.getSubtotal() == null ? 0.0 : request.getSubtotal();
        double deliveryPrice = chef.getDeliveryPrice();
        // FM-BUG-03
        if (chef.getFreeDeliveryFrom() != null && subtotal > chef.getFreeDeliveryFrom()) {
            deliveryPrice = 0.0;
        }
        return new DeliveryPriceResponseDto(deliveryPrice, chef.getFreeDeliveryFrom());
    }

    public PromoApplyResponseDto applyPromo(PromoApplyRequestDto request, String customerEmail) {
        double subtotal = request.getSubtotal() == null ? 0.0 : request.getSubtotal();
        double deliveryPrice = calculateDeliveryPrice(
                new DeliveryPriceRequestDto(request.getChefId(), subtotal, request.getDeliveryMethod())).getDeliveryPrice();
        PromoApplyResponseDto quote = promoService.quote(request.getCode(), subtotal, deliveryPrice);
        log.info("promo.applied {} {} {}", kv("code", quote.getCode()), kv("status", quote.getStatus()),
                kv("discount", quote.getDiscount()));
        return quote;
    }

    @Transactional
    public OrderCreateResponseDto createOrder(OrderDto orderDto, String customerEmail) {
        if (!"CASH".equals(orderDto.getPaymentType())) {
            throw new BadRequestException("Only CASH payment is supported");
        }

        Customer customer = customerRepository.findByEmail(customerEmail == null ? "" : customerEmail.trim().toLowerCase())
                .orElseThrow(() -> new NotFoundException("Customer not found"));

        Chef chef = chefRepository.findById(orderDto.getChefId())
                .orElseThrow(() -> new NotFoundException("Chef " + orderDto.getChefId() + " not found"));

        Order order = new Order();
        order.setChef(chef);
        order.setCustomer(customer);
        order.setStatus("NEW");
        order.setReceiverName(orderDto.getReceiverName());
        order.setReceiverPhoneNumber(orderDto.getReceiverPhoneNumber());
        order.setReceiverEmail(orderDto.getReceiverEmail());
        order.setPaymentType(orderDto.getPaymentType());
        order.setDeliveryMethod(orderDto.getDeliveryMethod());
        order.setNote(orderDto.getNote());
        // FM-BUG-06
        order.setCreatedAt(LocalDateTime.now());

        if ("DELIVERY".equals(orderDto.getDeliveryMethod()) && orderDto.getAddressDto() != null) {
            Address address = AddressDto.mapDtoToEntity(orderDto.getAddressDto());
            order.setAddress(address);
        }

        List<OrderDish> orderDishes = new ArrayList<>();
        double subtotal = 0.0;
        for (CreateOrderDishDto item : orderDto.getCreateOrderDishes()) {
            // FM-BUG-05
            Dish dish = dishRepository.findById(item.getDishId())
                    .orElseThrow(() -> new NotFoundException("Dish " + item.getDishId() + " not found"));

            OrderDish orderDish = new OrderDish();
            orderDish.setOrder(order);
            orderDish.setDish(dish);
            orderDish.setNameEn(dish.getNameEn());
            orderDish.setNameAm(dish.getNameAm());
            orderDish.setNameRu(dish.getNameRu());
            orderDish.setUrl(dish.getUrl());
            
            orderDish.setPrice(dish.getPrice());
            orderDish.setQuantity(item.getQuantity());

            double dishTotal = dish.getPrice();
            double additionsTotal = 0.0;
            if (item.getAdditions() != null && dish.getAdditions() != null) {
                List<am.foodme.backend.model.OrderDishAddition> orderAdditions = new ArrayList<>();
                for (am.foodme.backend.dto.CreateOrderDishAdditionDto addDto : item.getAdditions()) {
                    am.foodme.backend.model.DishAddition matchingAddition = dish.getAdditions().stream()
                            .filter(a -> a.getId().equals(addDto.getAdditionId()))
                            .findFirst().orElse(null);
                    if (matchingAddition != null) {
                        am.foodme.backend.model.OrderDishAddition oda = new am.foodme.backend.model.OrderDishAddition();
                        oda.setOrderDish(orderDish);
                        oda.setNameEn(matchingAddition.getNameEn());
                        oda.setNameAm(matchingAddition.getNameAm());
                        oda.setNameRu(matchingAddition.getNameRu());
                        oda.setPrice(matchingAddition.getPrice());
                        orderAdditions.add(oda);
                        additionsTotal += matchingAddition.getPrice();
                    }
                }
                orderDish.setAdditions(orderAdditions);
            }

            orderDishes.add(orderDish);

            // FM-BUG-01
            subtotal += (int) (dishTotal * item.getQuantity()) + additionsTotal;

        }
        order.setOrderDishList(orderDishes);

        double deliveryPrice = 0.0;
        if ("DELIVERY".equals(orderDto.getDeliveryMethod())) {
            DeliveryPriceRequestDto priceRequest = new DeliveryPriceRequestDto(chef.getId(), subtotal, "DELIVERY");
            deliveryPrice = calculateDeliveryPrice(priceRequest).getDeliveryPrice();
        }
        order.setDeliveryPrice(deliveryPrice);

        double discount = 0.0;
        if (orderDto.getPromoCode() != null && !orderDto.getPromoCode().isBlank()) {
            PromoApplyResponseDto quote = promoService.quote(orderDto.getPromoCode(), subtotal, deliveryPrice);
            if (!PromoService.APPLIED.equals(quote.getStatus())) {
                throw new BadRequestException("Promo code " + quote.getCode() + " cannot be applied");
            }
            discount = quote.getDiscount();
            order.setPromoCode(quote.getCode());
            order.setDiscount(discount);
            if (orderDto.getDiscount() != null && Math.abs(orderDto.getDiscount() - discount) > 0.5) {
                log.error("order.discount_mismatch {} {} {}", kv("code", quote.getCode()),
                        kv("quoted", orderDto.getDiscount()), kv("computed", discount));
            }
        }
        order.setTotalPrice(subtotal - discount + deliveryPrice);

        long seqValue = orderRepository.nextOrderNumberSequenceValue();
        order.setNumber("FM-" + (100000 + seqValue));

        Order saved = orderRepository.save(order);

        meterRegistry.counter("foodme.orders").increment();

        return new OrderCreateResponseDto(saved.getNumber(), saved.getStatus(), saved.getTotalPrice());
    }

    /**
     * Public order tracking. Anyone with the number can see the order's progress, but the
     * customer's review (SCRUM-4) is shown only to the customer who placed the order.
     */
    @Transactional(readOnly = true)
    public OrderDto getOrderByNumber(String number, String viewerEmail) {
        Order order = orderRepository.findByNumber(number)
                .orElseThrow(() -> new NotFoundException("Order " + number + " not found"));
        OrderDto dto = OrderDto.mapEntityToDto(order);
        if (!isPlacedBy(order, viewerEmail)) {
            dto.setRating(null);
        }
        return dto;
    }

    private static boolean isPlacedBy(Order order, String email) {
        return email != null
                && order.getCustomer() != null
                && order.getCustomer().getEmail() != null
                && order.getCustomer().getEmail().equalsIgnoreCase(email.trim());
    }

    /**
     * Lets a customer cancel their own order while the kitchen hasn't accepted it yet (status NEW).
     * Cancelling an already cancelled order is a no-op, so double taps and retries are safe.
     */
    @Transactional
    public OrderDto cancelForCustomer(String customerEmail, String number) {
        Customer customer = customerRepository.findByEmail(customerEmail == null ? "" : customerEmail.trim().toLowerCase())
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Order order = orderRepository.findByNumber(number)
                .orElseThrow(() -> new NotFoundException("Order " + number + " not found"));
        if (order.getCustomer() == null || !order.getCustomer().getId().equals(customer.getId())) {
            throw new ForbiddenException("You can only cancel your own orders");
        }
        if ("CANCELLED".equals(order.getStatus())) {
            return OrderDto.mapEntityToDto(order);
        }

        int updated = orderRepository.transitionStatus(order.getId(), "NEW", "CANCELLED");
        Order current = orderRepository.findById(order.getId())
                .orElseThrow(() -> new NotFoundException("Order " + number + " not found"));
        if (updated == 0 && !"CANCELLED".equals(current.getStatus())) {
            throw new ConflictException("ACCEPTED".equals(current.getStatus())
                    ? "This order can no longer be cancelled: the kitchen has already accepted it"
                    : "This order can no longer be cancelled");
        }
        if (updated == 1) {
            meterRegistry.counter("foodme.orders.cancelled").increment();
        }
        return OrderDto.mapEntityToDto(current);
    }

    @Transactional(readOnly = true)
    public OrderListResponseDto listForCustomer(String customerEmail, int page, int size) {
        Customer customer = customerRepository.findByEmail(customerEmail == null ? "" : customerEmail.trim().toLowerCase())
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Page<Order> orders = orderRepository.findByCustomerIdOrderByCreatedAtDesc(
                customer.getId(), PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50)));
        return new OrderListResponseDto(
                orders.getContent().stream().map(OrderDto::mapEntityToDto).toList(),
                orders.getTotalElements()
        );
    }
}
