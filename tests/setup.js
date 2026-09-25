// Loaded before every test file (see bunfig.toml).
process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-0123456789";
process.env.NEXT_PUBLIC_APP_URL ||= "http://localhost:3000";
process.env.PAYSTACK_SECRET_KEY ||= "sk_test_dummy_key_for_tests";
