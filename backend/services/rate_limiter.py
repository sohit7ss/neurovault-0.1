import threading
import time

class RateLimiter:
    """Thread-safe rate limiter to space out requests to AI APIs."""
    
    def __init__(self, calls_per_minute=10):
        self.calls_per_minute = calls_per_minute
        self.min_interval = 60.0 / calls_per_minute  # Interval in seconds
        self.last_call = 0
        self.lock = threading.Lock()
    
    def wait(self):
        """Blocks execution until the required interval has passed since the last call."""
        with self.lock:
            now = time.time()
            elapsed = now - self.last_call
            if elapsed < self.min_interval:
                sleep_time = self.min_interval - elapsed
                time.sleep(sleep_time)
            self.last_call = time.time()

# Global instance for Gemini API (safe default: 9 RPM)
gemini_rate_limiter = RateLimiter(calls_per_minute=9)
