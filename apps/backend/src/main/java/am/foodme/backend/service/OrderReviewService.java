package am.foodme.backend.service;

import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.dto.OrderReviewRequestDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderReview;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.OrderRepository;
import am.foodme.backend.repository.OrderReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class OrderReviewService {

    private final OrderRepository orderRepository;
    private final OrderReviewRepository orderReviewRepository;
    private final CustomerRepository customerRepository;
    private final ChefRepository chefRepository;

    public OrderReviewService(OrderRepository orderRepository, OrderReviewRepository orderReviewRepository,
                              CustomerRepository customerRepository, ChefRepository chefRepository) {
        this.orderRepository = orderRepository;
        this.orderReviewRepository = orderReviewRepository;
        this.customerRepository = customerRepository;
        this.chefRepository = chefRepository;
    }

    @Transactional
    public OrderDto reviewOrder(String number, OrderReviewRequestDto request, String customerEmail) {
        Customer customer = customerRepository.findByEmail(customerEmail == null ? "" : customerEmail.trim().toLowerCase())
                .orElseThrow(() -> new NotFoundException("Customer not found"));

        Order order = orderRepository.findByNumber(number)
                .orElseThrow(() -> new NotFoundException("Order " + number + " not found"));

        if (order.getCustomer() != null && !order.getCustomer().getId().equals(customer.getId())) {
            throw new NotFoundException("Order " + number + " not found");
        }
        if (!"DELIVERED".equals(order.getStatus())) {
            throw new BadRequestException("Only delivered orders can be reviewed.");
        }
        if (orderReviewRepository.existsByOrderId(order.getId())) {
            throw new BadRequestException("Order already reviewed.");
        }

        OrderReview review = new OrderReview();
        review.setOrder(order);
        review.setCustomer(customer);
        review.setChef(order.getChef());
        review.setRating(request.getRating());
        review.setComment(request.getComment());
        review.setCreatedAt(LocalDateTime.now());
        orderReviewRepository.save(review);
        order.setReview(review);

        updateChefRating(order.getChef());

        return OrderDto.mapEntityToDto(order);
    }

    private void updateChefRating(Chef chef) {
        List<OrderReview> reviews = orderReviewRepository.findByChefId(chef.getId());
        double sum = 0;
        for (OrderReview r : reviews) {
            sum += r.getRating();
        }
        double average = sum / reviews.size();
        chef.setRating(Math.floor(average * 10) / 10);
        chefRepository.save(chef);
    }
}
