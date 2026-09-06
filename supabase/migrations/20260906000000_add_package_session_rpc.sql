-- Restore a package session when appointment is cancelled/deleted
CREATE OR REPLACE FUNCTION add_package_session(p_customer_package_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE customer_packages
  SET sessions_remaining = LEAST(sessions_remaining + 1, total_sessions)
  WHERE id = p_customer_package_id;
END;
$$;
