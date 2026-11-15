package am.foodme.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Only a unique-key clash on order_rating means "already reviewed"; other violations are real errors. */
class OrderRatingServiceUnitTest {

    @Test
    void uniqueViolationIsRecognisedThroughTheCauseChain() {
        var e = new DataIntegrityViolationException("dup",
                new RuntimeException("wrapped", new SQLException("duplicate key", "23505")));
        assertTrue(OrderRatingService.isUniqueViolation(e));
    }

    @Test
    void otherConstraintViolationsAreNotTreatedAsAlreadyReviewed() {
        assertFalse(OrderRatingService.isUniqueViolation(
                new DataIntegrityViolationException("fk", new SQLException("fk", "23503"))));
        assertFalse(OrderRatingService.isUniqueViolation(
                new DataIntegrityViolationException("check", new SQLException("check", "23514"))));
        assertFalse(OrderRatingService.isUniqueViolation(new DataIntegrityViolationException("no cause")));
    }
}
