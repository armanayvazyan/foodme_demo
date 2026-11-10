package am.foodme.backend;

import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.repository.OrderRepository;
import am.foodme.backend.security.JwtService;
import am.foodme.backend.service.AdminOrderService;
import am.foodme.backend.service.OrderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FOODQA-2: customer order cancellation over HTTP, plus the conditional-update
 * guarantees for cancellation vs. kitchen acceptance. Every test creates its own
 * customer(s) and order(s); persisted status is read straight from the database.
 *
 * <p>Isolation: these tests must commit real orders (the race test needs committed
 * rows on two threads), and every order consumes {@code foodme.order_number_seq},
 * which no rollback resets. The other {@code @SpringBootTest} classes share one cached
 * context and one named in-memory H2 database ({@code jdbc:h2:mem:foodme}), so this
 * class points at its own in-memory database. The different datasource URL gives it a
 * separate Spring context (seeded from the same {@code data.sql}), and
 * {@code @DirtiesContext} closes that context, dropping its schema, after the class.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties =
        "spring.datasource.url=jdbc:h2:mem:foodme_foodqa2_cancellation;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class OrderCancellationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderService orderService;

    @Autowired
    private AdminOrderService adminOrderService;

    // ---------- helpers ----------

    private record CustomerAccount(String email, String token) {
    }

    private record PlacedOrder(String number, long id) {
    }

    private CustomerAccount registerCustomer() throws Exception {
        String email = "cancel-test-" + UUID.randomUUID() + "@example.com";
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann",
                                "email", email,
                                "phoneNumber", "+37491234567",
                                "password", "secret123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new CustomerAccount(email, objectMapper.readTree(response).get("token").asText());
    }

    private PlacedOrder placeOrder(CustomerAccount customer) throws Exception {
        Map<String, Object> body = Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        );
        String created = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customer.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEW"))
                .andReturn().getResponse().getContentAsString();
        String number = objectMapper.readTree(created).get("number").asText();
        String full = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new PlacedOrder(number, objectMapper.readTree(full).get("id").asLong());
    }

    private String adminToken() {
        return jwtService.generateToken("admin", "ADMIN");
    }

    private String persistedStatus(long orderId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM foodme.\"order\" WHERE id = ?", String.class, orderId);
    }

    private String persistedRejectReason(long orderId) {
        return jdbcTemplate.queryForObject(
                "SELECT reject_reason FROM foodme.\"order\" WHERE id = ?", String.class, orderId);
    }

    private org.springframework.test.web.servlet.ResultActions cancel(String token, String number) throws Exception {
        var request = post("/api/customer/orders/" + number + "/cancel");
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private org.springframework.test.web.servlet.ResultActions adminSetStatus(long orderId, String newStatus,
                                                                              String rejectReason) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("status", newStatus);
        body.put("rejectReason", rejectReason);
        return mockMvc.perform(patch("/admin/order/" + orderId + "/status")
                .header("Authorization", "Bearer " + adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    // ---------- AC 1: owner cancels a NEW order; customers-only; admins can't cancel ----------

    // I-1
    @Test
    void cancel_ownerCancelsNewOrder_becomesCancelledEverywhere() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);

        cancel(ann.token(), order.number())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(order.number()))
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertEquals("CANCELLED", persistedStatus(order.id()));
        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + ann.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].number").value(order.number()))
                .andExpect(jsonPath("$.list[0].status").value("CANCELLED"));
        mockMvc.perform(get("/api/order/number/" + order.number()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    // I-2
    @Test
    void cancel_withoutToken_unauthorizedAndUnchanged() throws Exception {
        PlacedOrder order = placeOrder(registerCustomer());

        cancel(null, order.number()).andExpect(status().isUnauthorized());

        assertEquals("NEW", persistedStatus(order.id()));
    }

    // I-3
    @Test
    void cancel_withAdminToken_forbiddenAndUnchanged() throws Exception {
        PlacedOrder order = placeOrder(registerCustomer());

        cancel(adminToken(), order.number()).andExpect(status().isForbidden());

        assertEquals("NEW", persistedStatus(order.id()));
    }

    // I-4
    @Test
    void adminCannotTransitionNewOrderToCancelled() throws Exception {
        PlacedOrder order = placeOrder(registerCustomer());

        adminSetStatus(order.id(), "CANCELLED", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot transition order from NEW to CANCELLED"));

        assertEquals("NEW", persistedStatus(order.id()));
    }

    // ---------- AC 2: another customer's order ----------

    // I-5
    @Test
    void cancel_otherCustomersOrder_notFoundAndUnchanged() throws Exception {
        CustomerAccount owner = registerCustomer();
        CustomerAccount other = registerCustomer();
        PlacedOrder order = placeOrder(owner);

        cancel(other.token(), order.number())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + order.number() + " not found"));

        assertEquals("NEW", persistedStatus(order.id()));
    }

    // ---------- AC 3: refused once the order is no longer NEW ----------

    // I-6
    @Test
    void cancel_afterAccepted_badRequestAndStaysAccepted() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);
        adminSetStatus(order.id(), "ACCEPTED", null).andExpect(status().isOk());

        cancel(ann.token(), order.number())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel order in status ACCEPTED"));

        assertEquals("ACCEPTED", persistedStatus(order.id()));
    }

    // I-7
    @Test
    void cancel_afterDelivered_badRequestAndStaysDelivered() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);
        adminSetStatus(order.id(), "ACCEPTED", null).andExpect(status().isOk());
        adminSetStatus(order.id(), "DELIVERED", null).andExpect(status().isOk());

        cancel(ann.token(), order.number())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel order in status DELIVERED"));

        assertEquals("DELIVERED", persistedStatus(order.id()));
    }

    // I-8
    @Test
    void cancel_afterRejected_badRequestAndReasonKept() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);
        adminSetStatus(order.id(), "REJECTED", "Kitchen closed").andExpect(status().isOk());

        cancel(ann.token(), order.number())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel order in status REJECTED"));

        assertEquals("REJECTED", persistedStatus(order.id()));
        assertEquals("Kitchen closed", persistedRejectReason(order.id()));
    }

    // I-9
    @Test
    void cancel_unknownOrderNumber_notFound() throws Exception {
        CustomerAccount ann = registerCustomer();
        String missing = "FM-NOPE-" + UUID.randomUUID();

        cancel(ann.token(), missing)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + missing + " not found"));
    }

    // ---------- AC 5: CANCELLED is terminal ----------

    // I-10
    @Test
    void cancelledOrder_adminCannotMoveItAnywhere() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);
        cancel(ann.token(), order.number()).andExpect(status().isOk());

        for (String target : List.of("ACCEPTED", "REJECTED", "DELIVERED", "NEW")) {
            adminSetStatus(order.id(), target, "reason")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Cannot transition order from CANCELLED to " + target));
            assertEquals("CANCELLED", persistedStatus(order.id()));
        }
    }

    // I-11
    @Test
    void cancelledOrder_secondCancel_badRequest() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);
        cancel(ann.token(), order.number()).andExpect(status().isOk());

        cancel(ann.token(), order.number())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel order in status CANCELLED"));

        assertEquals("CANCELLED", persistedStatus(order.id()));
    }

    // ---------- Admin REJECTED behaviour is preserved ----------

    // I-12
    @Test
    void adminRejectsNewOrder_reasonPersisted() throws Exception {
        PlacedOrder order = placeOrder(registerCustomer());

        adminSetStatus(order.id(), "REJECTED", "Kitchen closed")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectReason").value("Kitchen closed"));

        mockMvc.perform(get("/admin/order/" + order.id()).header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectReason").value("Kitchen closed"));
        assertEquals("REJECTED", persistedStatus(order.id()));
        assertEquals("Kitchen closed", persistedRejectReason(order.id()));
    }

    // I-13
    @Test
    void adminRejectsAcceptedOrder_reasonPersisted() throws Exception {
        PlacedOrder order = placeOrder(registerCustomer());
        adminSetStatus(order.id(), "ACCEPTED", null).andExpect(status().isOk());

        adminSetStatus(order.id(), "REJECTED", "Ran out of dough")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectReason").value("Ran out of dough"));

        assertEquals("REJECTED", persistedStatus(order.id()));
        assertEquals("Ran out of dough", persistedRejectReason(order.id()));
    }

    // ---------- AC 7: atomic transitions, persisted status for both outcomes ----------

    // I-15a: cancellation wins
    @Test
    void cancellationFirst_thenAcceptance_isRejected_persistedCancelled() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);

        cancel(ann.token(), order.number()).andExpect(status().isOk());
        adminSetStatus(order.id(), "ACCEPTED", null).andExpect(status().isBadRequest());

        assertEquals("CANCELLED", persistedStatus(order.id()));
    }

    // I-15b: acceptance wins
    @Test
    void acceptanceFirst_thenCancellation_isRejected_persistedAccepted() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);

        adminSetStatus(order.id(), "ACCEPTED", null).andExpect(status().isOk());
        cancel(ann.token(), order.number()).andExpect(status().isBadRequest());

        assertEquals("ACCEPTED", persistedStatus(order.id()));
    }

    // I-16a: a stale "NEW" acceptance can't overwrite a committed cancellation
    @Test
    void conditionalUpdate_staleAcceptAfterCancel_changesNoRows() throws Exception {
        CustomerAccount ann = registerCustomer();
        PlacedOrder order = placeOrder(ann);
        cancel(ann.token(), order.number()).andExpect(status().isOk());

        Integer changed = transactionTemplate.execute(tx ->
                orderRepository.transitionStatus(order.id(), "NEW", "ACCEPTED"));

        assertEquals(0, changed);
        assertEquals("CANCELLED", persistedStatus(order.id()));
    }

    // I-16b: a stale "NEW" cancellation can't overwrite a committed acceptance
    @Test
    void conditionalUpdate_staleCancelAfterAccept_changesNoRows() throws Exception {
        PlacedOrder order = placeOrder(registerCustomer());
        adminSetStatus(order.id(), "ACCEPTED", null).andExpect(status().isOk());

        Integer changed = transactionTemplate.execute(tx ->
                orderRepository.transitionStatus(order.id(), "NEW", "CANCELLED"));

        assertEquals(0, changed);
        assertEquals("ACCEPTED", persistedStatus(order.id()));
    }

    // I-14: real concurrent race, repeated on fresh orders
    @Test
    void concurrentCancelAndAccept_exactlyOneWins_persistedStatusMatchesWinner() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 20; round++) {
                CustomerAccount ann = registerCustomer();
                PlacedOrder order = placeOrder(ann);
                CountDownLatch start = new CountDownLatch(1);

                Callable<String> cancelCall = () -> {
                    start.await();
                    try {
                        orderService.cancelOrder(order.number(), ann.email());
                        return "OK";
                    } catch (BadRequestException e) {
                        return "REFUSED";
                    }
                };
                Callable<String> acceptCall = () -> {
                    start.await();
                    try {
                        adminOrderService.updateStatus(order.id(), "ACCEPTED", null);
                        return "OK";
                    } catch (BadRequestException e) {
                        return "REFUSED";
                    }
                };

                Future<String> cancelResult = pool.submit(cancelCall);
                Future<String> acceptResult = pool.submit(acceptCall);
                start.countDown();
                String cancelOutcome = cancelResult.get(30, TimeUnit.SECONDS);
                String acceptOutcome = acceptResult.get(30, TimeUnit.SECONDS);

                String message = "round " + round + ": cancel=" + cancelOutcome + ", accept=" + acceptOutcome;
                assertTrue("OK".equals(cancelOutcome) ^ "OK".equals(acceptOutcome),
                        "exactly one transition must succeed, " + message);
                String expected = "OK".equals(cancelOutcome) ? "CANCELLED" : "ACCEPTED";
                assertEquals(expected, persistedStatus(order.id()), message);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
