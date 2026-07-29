-- ============================================
-- STATISTICS RPCs FOR HOME SYNC
-- ============================================

-- Get task stats by category
CREATE OR REPLACE FUNCTION get_task_stats_by_category(p_user_id UUID)
RETURNS TABLE(category TEXT, completed_count BIGINT, total_xp BIGINT, total_coins BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.category,
    COUNT(*)::BIGINT as completed_count,
    COALESCE(SUM(t.xp_reward), 0)::BIGINT as total_xp,
    COALESCE(SUM(t.coin_reward), 0)::BIGINT as total_coins
  FROM tasks t
  INNER JOIN household_members hm ON t.household_id = hm.household_id
  WHERE hm.user_id = p_user_id
    AND t.status = 'verified'
    AND t.completed_at >= NOW() - INTERVAL '30 days'
  GROUP BY t.category
  ORDER BY completed_count DESC;
END;
$$;

-- Get XP history (last 7 days)
CREATE OR REPLACE FUNCTION get_xp_history(p_user_id UUID)
RETURNS TABLE(day DATE, xp_earned BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(le.created_at) as day,
    COALESCE(SUM(le.amount), 0)::BIGINT as xp_earned
  FROM ledger_entries le
  WHERE le.user_id = p_user_id
    AND le.currency = 'xp'
    AND le.type = 'xp_earned'
    AND le.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY DATE(le.created_at)
  ORDER BY day ASC;
END;
$$;

-- Get coin history (last 7 days)
CREATE OR REPLACE FUNCTION get_coin_history(p_user_id UUID)
RETURNS TABLE(day DATE, coins_change BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(le.created_at) as day,
    COALESCE(SUM(le.amount), 0)::BIGINT as coins_change
  FROM ledger_entries le
  WHERE le.user_id = p_user_id
    AND le.currency = 'coins'
    AND le.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY DATE(le.created_at)
  ORDER BY day ASC;
END;
$$;

-- Get expense stats by category (for household)
CREATE OR REPLACE FUNCTION get_expense_stats_by_category(p_user_id UUID)
RETURNS TABLE(category TEXT, total_amount NUMERIC, expense_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  SELECT household_id INTO v_household_id
  FROM household_members
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    e.category,
    COALESCE(SUM(e.amount), 0)::NUMERIC as total_amount,
    COUNT(*)::BIGINT as expense_count
  FROM expenses e
  WHERE e.household_id = v_household_id
    AND e.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY e.category
  ORDER BY total_amount DESC;
END;
$$;

-- Get member activity stats
CREATE OR REPLACE FUNCTION get_member_activity_stats(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  tasks_completed BIGINT,
  xp_earned BIGINT,
  coins_earned BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  SELECT household_id INTO v_household_id
  FROM household_members
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email as user_email,
    COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'verified'), 0)::BIGINT as tasks_completed,
    COALESCE(SUM(le.xp) FILTER (WHERE le.currency = 'xp'), 0)::BIGINT as xp_earned,
    COALESCE(SUM(le.amount) FILTER (WHERE le.currency = 'coins' AND le.amount > 0), 0)::BIGINT as coins_earned
  FROM users u
  INNER JOIN household_members hm ON u.id = hm.user_id
  LEFT JOIN tasks t ON t.household_id = hm.household_id AND t.completed_by = u.id
  LEFT JOIN ledger_entries le ON le.user_id = u.id AND le.created_at >= NOW() - INTERVAL '30 days'
  WHERE hm.household_id = v_household_id
  GROUP BY u.id, u.email
  ORDER BY tasks_completed DESC;
END;
$$;

-- Get weekly task summary
CREATE OR REPLACE FUNCTION get_weekly_task_summary(p_user_id UUID)
RETURNS TABLE(
  day_of_week TEXT,
  tasks_completed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(t.completed_at, 'Day') as day_of_week,
    COUNT(*)::BIGINT as tasks_completed
  FROM tasks t
  INNER JOIN household_members hm ON t.household_id = hm.household_id
  WHERE hm.user_id = p_user_id
    AND t.status = 'verified'
    AND t.completed_at >= NOW() - INTERVAL '7 days'
  GROUP BY TO_CHAR(t.completed_at, 'Day'), DATE(t.completed_at)
  ORDER BY DATE(t.completed_at) ASC;
END;
$$;