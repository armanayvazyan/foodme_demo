package am.foodme.backend.service;

import am.foodme.backend.dto.OrderRatingDto;
import am.foodme.backend.dto.OrderRatingRequestDto;
import am.foodme.backend.dto.OrderRatingSubmissionDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderRating;
import am.foodme.backend.repository.OrderRatingRepository;
import am.foodme.backend.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class OrderRatingService {

    private final CustomerAuthService customerAuthService;
    private final OrderRepository orderRepository;
    private final OrderRatingRepository orderRatingRepository;
    private final ChefRatingService chefRatingService;

    public OrderRatingService(CustomerAuthService customerAuthService,
                              OrderRepository orderRepository,
                              OrderRatingRepository orderRatingRepository,
                              ChefRatingService chefRatingService) {
        this.customerAuthService = customerAuthService;
        this.orderRepository = orderRepository;
        this.orderRatingRepository = orderRatingRepository;
        this.chefRatingService = chefRatingService;
    }

    @Transactional
    public OrderRatingSubmissionDto rateForCustomer(String number,
                                                    String customerEmail,
                                                    OrderRatingRequestDto request) {
        Customer customer = customerAuthService.requireByEmail(customerEmail);
        Order order = orderRepository.findByNumberAndCustomerIdForUpdate(number, customer.getId())
                .orElseThrow(() -> new NotFoundException("Order " + number + " not found"));

        if (!"DELIVERED".equals(order.getStatus())) {
            throw new BadRequestException("Only delivered orders can be reviewed.");
        }
        if (orderRatingRepository.existsByOrderId(order.getId())) {
            throw new BadRequestException("Order already reviewed.");
        }

        int ratingValue;
        try {
            ratingValue = request.getRating().intValueExact();
        } catch (ArithmeticException ex) {
            throw new BadRequestException("Rating must be a whole number from 1 to 5");
        }
        if (ratingValue < 1 || ratingValue > 5) {
            throw new BadRequestException("Rating must be a whole number from 1 to 5");
        }

        OrderRating rating = new OrderRating();
        rating.setOrder(order);
        rating.setCustomer(customer);
        rating.setChef(order.getChef());
        rating.setRating(ratingValue);
        rating.setComment(request.getComment());
        rating.setCreatedAt(Instant.now());

        OrderRating saved = orderRatingRepository.saveAndFlush(rating);
        order.setReview(saved);
        return new OrderRatingSubmissionDto(
                OrderRatingDto.mapEntityToDto(saved),
                order.getChef().getId(),
                chefRatingService.getAverage(order.getChef().getId())
        );
    }
}
