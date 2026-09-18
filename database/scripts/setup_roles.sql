-- Database Privileged Setup Script: Group Roles & Hierarchy Initialization
-- Executed once per PostgreSQL cluster by postgres / superuser identity.

DO $$
BEGIN
    -- 1. NOLOGIN Group Roles
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finintel_owner') THEN
        CREATE ROLE finintel_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finintel_security_definer') THEN
        CREATE ROLE finintel_security_definer WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finintel_app') THEN
        CREATE ROLE finintel_app WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finintel_bff') THEN
        CREATE ROLE finintel_bff WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;

    -- 2. Role Hierarchy
    GRANT finintel_security_definer TO finintel_owner;
END $$;
