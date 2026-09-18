-- Local Development Login Roles Setup Script
-- Executed once by superuser/postgres identity in local development environments.

DO $$
BEGIN
    -- 1. Development Owner Login
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dev_owner_login') THEN
        CREATE USER dev_owner_login WITH PASSWORD 'owner_dev_pass' IN ROLE finintel_owner NOINHERIT;
    END IF;

    -- 2. Development Core API Login
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dev_app_login') THEN
        CREATE USER dev_app_login WITH PASSWORD 'app_dev_pass' IN ROLE finintel_app NOINHERIT;
    END IF;

    -- 3. Development BFF Login
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dev_bff_login') THEN
        CREATE USER dev_bff_login WITH PASSWORD 'bff_dev_pass' IN ROLE finintel_bff NOINHERIT;
    END IF;

    -- Ensure explicit role grants
    GRANT finintel_owner TO dev_owner_login;
    GRANT finintel_app TO dev_app_login;
    GRANT finintel_bff TO dev_bff_login;
END $$;
