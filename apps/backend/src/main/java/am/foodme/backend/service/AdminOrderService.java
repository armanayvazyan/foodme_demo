package am.foodme.backend.service;

import am.foodme.backend.dto.AdminListResponseDto;
import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Order;
import am.foodme.backend.repository.OrderRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminOrderService {

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            "NEW", Set.of("ACCEPTED", "REJECTED"),
            "ACCEPTED", Set.of("DELIVERED", "REJECTED"),
            // Final statuses: an admin can't move an order out of these.
            "DELIVERED", Set.of(),
            "REJECTED", Set.of(),
            "CANCELLED", Set.of()
    );

    private final OrderRepository orderRepository;

    public AdminOrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public AdminListResponseDto<OrderDto> list(int page, int size, String status) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orderPage = (status == null || status.isBlank())
                ? orderRepository.findAll(pageable)
                : orderRepository.findByStatus(status, pageable);
        List<OrderDto> list = orderPage.getContent().stream()
                .map(OrderDto::mapEntityToDto)
                .collect(Collectors.toList());
        return new AdminListResponseDto<>(list, orderPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public OrderDto getById(Long id) {
        return OrderDto.mapEntityToDto(findEntity(id));
    }

    @Transactional
    public OrderDto updateStatus(Long id, String newStatus, String rejectReason) {
        Order order = findEntity(id);
        Set<String> allowed = ALLOWED_TRANSITIONS.get(order.getStatus());
        if (allowed == null || !allowed.contains(newStatus)) {
            throw new BadRequestException("Cannot transition order from " + order.getStatus() + " to " + newStatus);
        }
        // Conditional write: if the customer cancelled (or another admin changed the status)
        // after we read the order, this updates 0 rows instead of overwriting their change.
        if (orderRepository.updateStatusIfCurrent(id, order.getStatus(), newStatus) == 0) {
            throw new BadRequestException("Order " + id + " was changed by someone else; reload and try again");
        }
        Order updated = findEntity(id);
        if ("REJECTED".equals(newStatus)) {
            updated.setRejectReason(rejectReason);
        }
        return OrderDto.mapEntityToDto(orderRepository.save(updated));
    }

    private Order findEntity(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Order " + id + " not found"));
    }
}
