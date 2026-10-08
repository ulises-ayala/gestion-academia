--
-- PostgreSQL database dump
--

\restrict cpgUnZ6pCwc6nlsOZ3WQfbdYwwNgwZ0bz73eQy6QL9qP0TNY6HTozZRITtg4gCm

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AdminRole; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."AdminRole" AS ENUM (
    'ADMINISTRATOR',
    'RECEPTION',
    'MANAGER'
);


ALTER TYPE public."AdminRole" OWNER TO academy;

--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'JUSTIFIED'
);


ALTER TYPE public."AttendanceStatus" OWNER TO academy;

--
-- Name: BillingAdjustmentType; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."BillingAdjustmentType" AS ENUM (
    'DIRECTION_SCHOLARSHIP',
    'TEACHER_SCHOLARSHIP',
    'TEACHER_DISCOUNT',
    'LATE_FEE',
    'REVERSAL'
);


ALTER TYPE public."BillingAdjustmentType" OWNER TO academy;

--
-- Name: BillingCalculation; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."BillingCalculation" AS ENUM (
    'PERCENTAGE',
    'FIXED'
);


ALTER TYPE public."BillingCalculation" OWNER TO academy;

--
-- Name: CashMovementType; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."CashMovementType" AS ENUM (
    'COLLECTION',
    'REVERSAL'
);


ALTER TYPE public."CashMovementType" OWNER TO academy;

--
-- Name: CashShiftStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."CashShiftStatus" AS ENUM (
    'OPEN',
    'CLOSED'
);


ALTER TYPE public."CashShiftStatus" OWNER TO academy;

--
-- Name: DayOfWeek; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."DayOfWeek" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);


ALTER TYPE public."DayOfWeek" OWNER TO academy;

--
-- Name: EnrollmentStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."EnrollmentStatus" AS ENUM (
    'ACTIVE',
    'ENDED'
);


ALTER TYPE public."EnrollmentStatus" OWNER TO academy;

--
-- Name: LeadSource; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."LeadSource" AS ENUM (
    'WHATSAPP',
    'INSTAGRAM',
    'IN_PERSON'
);


ALTER TYPE public."LeadSource" OWNER TO academy;

--
-- Name: LeadStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."LeadStatus" AS ENUM (
    'INQUIRY',
    'INTERESTED',
    'TRIAL',
    'ENROLLED',
    'NOT_CONVERTED'
);


ALTER TYPE public."LeadStatus" OWNER TO academy;

--
-- Name: MonthlyChargeStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."MonthlyChargeStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'VOID'
);


ALTER TYPE public."MonthlyChargeStatus" OWNER TO academy;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'MERCADO_PAGO',
    'CARD'
);


ALTER TYPE public."PaymentMethod" OWNER TO academy;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'CONFIRMED',
    'VOID'
);


ALTER TYPE public."PaymentStatus" OWNER TO academy;

--
-- Name: RecordStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."RecordStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."RecordStatus" OWNER TO academy;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO academy;

--
-- Name: admin_sessions; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.admin_sessions (
    id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.admin_sessions OWNER TO academy;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.admin_users (
    id uuid NOT NULL,
    username character varying(100) NOT NULL,
    password_hash text NOT NULL,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    role public."AdminRole" DEFAULT 'RECEPTION'::public."AdminRole" NOT NULL
);


ALTER TABLE public.admin_users OWNER TO academy;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id uuid,
    reason character varying(500),
    before jsonb,
    after jsonb,
    metadata jsonb,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO academy;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.branches (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    address text NOT NULL,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.branches OWNER TO academy;

--
-- Name: cash_movements; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.cash_movements (
    id uuid NOT NULL,
    cash_shift_id uuid NOT NULL,
    type public."CashMovementType" NOT NULL,
    method public."PaymentMethod" NOT NULL,
    amount numeric(12,2) NOT NULL,
    source_payment_id uuid NOT NULL,
    source_payment_tender_id uuid NOT NULL,
    reversal_of_id uuid,
    actor_user_id uuid NOT NULL,
    reason character varying(500),
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cash_movements_positive_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT cash_movements_reversal_link_check CHECK ((((type = 'COLLECTION'::public."CashMovementType") AND (reversal_of_id IS NULL)) OR ((type = 'REVERSAL'::public."CashMovementType") AND (reversal_of_id IS NOT NULL))))
);


ALTER TABLE public.cash_movements OWNER TO academy;

--
-- Name: cash_reconciliation_corrections; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.cash_reconciliation_corrections (
    id uuid NOT NULL,
    cash_shift_id uuid NOT NULL,
    method public."PaymentMethod" NOT NULL,
    amount_delta numeric(12,2) NOT NULL,
    original_declared_amount numeric(12,2) NOT NULL,
    corrected_declared_amount numeric(12,2) NOT NULL,
    reason character varying(500) NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cash_reconciliation_corrections_amounts_check CHECK (((original_declared_amount >= (0)::numeric) AND (corrected_declared_amount >= (0)::numeric))),
    CONSTRAINT cash_reconciliation_corrections_reason_check CHECK ((length(TRIM(BOTH FROM reason)) > 0))
);


ALTER TABLE public.cash_reconciliation_corrections OWNER TO academy;

--
-- Name: cash_shift_closing_lines; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.cash_shift_closing_lines (
    id uuid NOT NULL,
    cash_shift_id uuid NOT NULL,
    method public."PaymentMethod" NOT NULL,
    expected_amount numeric(12,2) NOT NULL,
    declared_amount numeric(12,2) NOT NULL,
    difference_amount numeric(12,2) NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cash_shift_closing_lines_amounts_check CHECK (((expected_amount >= (0)::numeric) AND (declared_amount >= (0)::numeric)))
);


ALTER TABLE public.cash_shift_closing_lines OWNER TO academy;

--
-- Name: cash_shifts; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.cash_shifts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public."CashShiftStatus" DEFAULT 'OPEN'::public."CashShiftStatus" NOT NULL,
    opened_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at timestamp(3) with time zone,
    closed_by_user_id uuid,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT cash_shifts_closed_fields_check CHECK ((((status = 'OPEN'::public."CashShiftStatus") AND (closed_at IS NULL) AND (closed_by_user_id IS NULL)) OR ((status = 'CLOSED'::public."CashShiftStatus") AND (closed_at IS NOT NULL) AND (closed_by_user_id IS NOT NULL))))
);


ALTER TABLE public.cash_shifts OWNER TO academy;

--
-- Name: class_schedules; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.class_schedules (
    id uuid NOT NULL,
    class_id uuid NOT NULL,
    day_of_week public."DayOfWeek" NOT NULL,
    start_time time(0) without time zone NOT NULL,
    end_time time(0) without time zone NOT NULL,
    room_id uuid NOT NULL,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT class_schedules_time_order_check CHECK ((end_time > start_time))
);


ALTER TABLE public.class_schedules OWNER TO academy;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.classes (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    dance_type_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    level character varying(100),
    capacity integer NOT NULL,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT classes_capacity_positive_check CHECK ((capacity > 0))
);


ALTER TABLE public.classes OWNER TO academy;

--
-- Name: dance_types; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.dance_types (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    normalized_name character varying(100) NOT NULL,
    description text,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.dance_types OWNER TO academy;

--
-- Name: enrollment_billing_conditions; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.enrollment_billing_conditions (
    id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    type public."BillingAdjustmentType" NOT NULL,
    calculation public."BillingCalculation" NOT NULL,
    configured_value numeric(12,2) NOT NULL,
    effective_from date NOT NULL,
    effective_until date,
    teacher_id uuid,
    authorized_by_user_id uuid,
    created_by_user_id uuid NOT NULL,
    ended_by_user_id uuid,
    ended_at timestamp(3) with time zone,
    reason character varying(500) NOT NULL,
    end_reason character varying(500),
    renewed_from_id uuid,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT billing_condition_supported_type CHECK ((type = ANY (ARRAY['DIRECTION_SCHOLARSHIP'::public."BillingAdjustmentType", 'TEACHER_SCHOLARSHIP'::public."BillingAdjustmentType", 'TEACHER_DISCOUNT'::public."BillingAdjustmentType"]))),
    CONSTRAINT billing_condition_valid_range CHECK (((effective_until IS NULL) OR (effective_until >= effective_from))),
    CONSTRAINT billing_condition_value CHECK (((configured_value > (0)::numeric) AND ((calculation <> 'PERCENTAGE'::public."BillingCalculation") OR (configured_value <= (100)::numeric))))
);


ALTER TABLE public.enrollment_billing_conditions OWNER TO academy;

--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.enrollments (
    id uuid NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status public."EnrollmentStatus" DEFAULT 'ACTIVE'::public."EnrollmentStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT enrollments_dates_check CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);


ALTER TABLE public.enrollments OWNER TO academy;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.leads (
    id uuid NOT NULL,
    name character varying(180) NOT NULL,
    phone character varying(80),
    normalized_phone character varying(50),
    email character varying(254),
    normalized_email character varying(254),
    instagram character varying(100),
    normalized_instagram character varying(100),
    source public."LeadSource" NOT NULL,
    status public."LeadStatus" DEFAULT 'INQUIRY'::public."LeadStatus" NOT NULL,
    notes text,
    next_follow_up_at timestamp(3) with time zone,
    last_contact_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.leads OWNER TO academy;

--
-- Name: monthly_charge_adjustments; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.monthly_charge_adjustments (
    id uuid NOT NULL,
    monthly_charge_id uuid NOT NULL,
    source_condition_id uuid,
    type public."BillingAdjustmentType" NOT NULL,
    calculation public."BillingCalculation",
    configured_value numeric(12,2),
    effective_amount numeric(12,2) NOT NULL,
    student_amount_delta numeric(12,2) NOT NULL,
    settlement_base_delta numeric(12,2) NOT NULL,
    teacher_id uuid,
    authorized_by_user_id uuid,
    created_by_user_id uuid,
    reason character varying(500),
    reversal_of_id uuid,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT charge_adjustment_effective_amount CHECK ((effective_amount >= (0)::numeric))
);


ALTER TABLE public.monthly_charge_adjustments OWNER TO academy;

--
-- Name: monthly_charges; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.monthly_charges (
    id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    tariff_id uuid NOT NULL,
    period date NOT NULL,
    base_amount numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    final_amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    status public."MonthlyChargeStatus" DEFAULT 'PENDING'::public."MonthlyChargeStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT monthly_charges_amounts_check CHECK (((base_amount >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (final_amount >= (0)::numeric) AND (discount_amount <= base_amount) AND (final_amount = (base_amount - discount_amount)))),
    CONSTRAINT monthly_charges_due_date_check CHECK (((due_date >= period) AND (due_date <= (period + 9)))),
    CONSTRAINT monthly_charges_period_check CHECK ((EXTRACT(day FROM period) = (1)::numeric))
);


ALTER TABLE public.monthly_charges OWNER TO academy;

--
-- Name: payment_allocations; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.payment_allocations (
    id uuid NOT NULL,
    payment_id uuid NOT NULL,
    monthly_charge_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT payment_allocations_amount_positive CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.payment_allocations OWNER TO academy;

--
-- Name: payment_tenders; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.payment_tenders (
    id uuid NOT NULL,
    payment_id uuid NOT NULL,
    method public."PaymentMethod" NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT payment_tenders_amount_positive CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.payment_tenders OWNER TO academy;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    student_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    status public."PaymentStatus" DEFAULT 'CONFIRMED'::public."PaymentStatus" NOT NULL,
    paid_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid NOT NULL,
    voided_at timestamp(3) with time zone,
    voided_by_user_id uuid,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT payments_amount_positive CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.payments OWNER TO academy;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.rooms (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    capacity integer NOT NULL,
    branch_id uuid NOT NULL,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT rooms_capacity_positive_check CHECK ((capacity > 0))
);


ALTER TABLE public.rooms OWNER TO academy;

--
-- Name: student_attendances; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.student_attendances (
    id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    attendance_date date NOT NULL,
    status public."AttendanceStatus" NOT NULL,
    notes text,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.student_attendances OWNER TO academy;

--
-- Name: students; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.students (
    id uuid NOT NULL,
    dni character varying(32) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    birth_date date,
    phone character varying(50),
    email character varying(254),
    address text,
    joined_at date DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.students OWNER TO academy;

--
-- Name: tariffs; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.tariffs (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    amount numeric(12,2) NOT NULL,
    valid_from date NOT NULL,
    valid_to date,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    class_id uuid NOT NULL,
    CONSTRAINT tariffs_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT tariffs_validity_check CHECK (((valid_to IS NULL) OR (valid_to >= valid_from)))
);


ALTER TABLE public.tariffs OWNER TO academy;

--
-- Name: teachers; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.teachers (
    id uuid NOT NULL,
    dni character varying(32) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(50),
    email character varying(254),
    address text,
    status public."RecordStatus" DEFAULT 'ACTIVE'::public."RecordStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.teachers OWNER TO academy;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
8c4abd5e-485b-467f-ba75-2c2c024fcbb2	21ebf9d71756aaa6cc82e46b1bf4a3069d05335ad7410326d4db2c6e22bc09a9	2026-08-20 23:37:43.943967+00	20260820180000_initial	\N	\N	2026-08-20 23:37:43.822262+00	1
1d004b5b-970a-45f3-9562-0c450d59bb17	cf12e58f9e666837059f30737d367d30d2acda11f10e09b0059e9f2cbbfd7642	2026-09-02 22:19:03.986726+00	20260830233411_payments_v2_tender_id_default	\N	\N	2026-09-02 22:19:03.971705+00	1
14d14581-b36c-40c3-9d73-e69ed6ce5ea6	a1b7f3e42d573217b5c38af36177e2cd4bd14c2c817f6d6f76bca7f9bd3801c1	2026-08-20 23:37:44.008003+00	20260820190000_admin_authentication	\N	\N	2026-08-20 23:37:43.949181+00	1
476450a4-7f49-460d-8750-ed57344455e7	d8cd9d45c3dc0748202ce38dd4a17ac131e236db8c8204251730dfd053f91ebc	2026-08-20 23:37:44.19424+00	20260820200000_academic_offering_v1	\N	\N	2026-08-20 23:37:44.013163+00	1
7933621a-30b8-4de2-bc7b-1eda3b54781f	bcd3429e249e00c769b9fd9a15102021bcb1da22f922dbdaeab8becc3d8d33eb	2026-08-20 23:37:44.254078+00	20260820213000_enrollments_v1	\N	\N	2026-08-20 23:37:44.199047+00	1
2c4d9303-d620-4faf-ad4a-eb3bc911b2dd	1ab52b01063fb216d852eb4e147f4517dc297f1966f4bbd6fb2731808392533d	2026-09-02 22:19:04.132152+00	20260831190000_billing_adjustments_v1	\N	\N	2026-09-02 22:19:03.99159+00	1
fdee3e38-913f-41ca-8f3c-b964b9f44440	ed8d705afd87717340948ff46e3da735c0c1b902dd56d3a5424a105b62dbeac3	2026-08-20 23:37:44.363837+00	20260820230000_tariffs_monthly_charges_v1	\N	\N	2026-08-20 23:37:44.259036+00	1
311f85d2-1e17-4881-868a-d70d56e3fbf3	ce6153e325a2db4eeb2a0f9d94105a723df7ddb30fa029287992d7ccebc7ec18	2026-08-20 23:37:54.955741+00	20260820233754_migration1	\N	\N	2026-08-20 23:37:54.938328+00	1
d09aa298-f34b-48e9-94b2-f7551d8e199f	08a465e5cccd953f80ad3d1d287b41a3efbb25777048b2bf98fb39215072281f	2026-08-21 22:28:21.188204+00	20260821222821_add_student_attendances	\N	\N	2026-08-21 22:28:21.115993+00	1
653dc88b-703e-4447-85d0-0f26b1424ed8	9464bed7e88fd421fd13d09d7a9b52ff8b733d8f181bf75178901eb104bbe2cb	2026-09-02 22:19:04.153533+00	20260831195820_	\N	\N	2026-09-02 22:19:04.13721+00	1
4c686ebc-1e6d-447e-b4e6-c69409c205d7	b2845a1a20942e294c9eb6e49cdc773da008f37d5397a0a01ea17ca55459a853	2026-08-28 21:33:14.675011+00	20260827090000_attendance_timestamps_timestamptz	\N	\N	2026-08-28 21:33:14.60754+00	1
a3575b19-a724-4763-9a89-c1d9d6a5267c	df2ccaf9ef2818ee2fc57fe905a7246c8e0a87d9bae965477268bcd266762ca0	2026-08-28 21:33:14.774978+00	20260828120000_payments_v1	\N	\N	2026-08-28 21:33:14.680433+00	1
26ba4ce1-d839-4430-8d20-3d440b862214	15ee2903ce1d87bfdea64fb6fbac2855f93900303dac68710bfa9d103bde6fbc	2026-09-02 22:19:03.786545+00	20260829210000_audit_log_v1	\N	\N	2026-09-02 22:19:03.708513+00	1
b5d527f2-29e8-403c-b450-b482d88afec9	54d9aa726332bf2a803dbd1b74c6e33d5737770b5fc4ff53e6c470bce81cdd34	2026-09-02 22:19:04.337844+00	20260831213000_cash_shift_v1	\N	\N	2026-09-02 22:19:04.158644+00	1
fd5543ea-417d-4150-bfae-bd9955e87379	a2764d14cb2428dfa5e94d234b323a72e382f4bde9f6b46fc517054246acbfd9	2026-09-02 22:19:03.89048+00	20260830100000_lead_management_v1	\N	\N	2026-09-02 22:19:03.791757+00	1
a1ecbc99-3d6c-4b9e-b614-01d9ef856c69	c707e565682033f75ff8435cfa45ab8965c0cd8888c3d72174417f12920a0905	2026-09-02 22:19:03.912067+00	20260830153427_	\N	\N	2026-09-02 22:19:03.895561+00	1
f6eb17e5-81ee-4711-a834-002fd54c23fa	6c9a46a8d5a232d911acad7494273414950145ef4d0128777e1498ade659c514	2026-09-02 22:19:03.966034+00	20260830200000_payments_v2_core	\N	\N	2026-09-02 22:19:03.917342+00	1
26255065-1dd7-40c8-8484-b1ce452dfce0	dee47658e0129c6d94e4f6d6fbb6368ea611a33633f58aea90dac4807164eebb	2026-09-28 20:36:28.030542+00	20260928203627_add_class_to_tariffs	\N	\N	2026-09-28 20:36:27.99769+00	1
\.


--
-- Data for Name: admin_sessions; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.admin_sessions (id, token_hash, user_id, expires_at, created_at) FROM stdin;
893bfd6d-92fb-4ece-936b-e0fcfcd3c026	1d87eae58b9d0bc290cf5272b87be0380c8aa51cf42f2dff8c18ce7c9b8b8f8a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-22 09:12:09.522+00	2026-08-21 21:12:09.524+00
a2e93dfa-aba0-496e-927a-09ac4dd78e79	1136db9294216db1ccc61a9b159fdff1c3b9c02be162a5b0513afb93956a1e46	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-22 11:48:51.858+00	2026-08-21 23:48:51.859+00
d7ddcbd6-4de5-4b8b-ad62-57b588a39dbf	a8d82f30fbb528355da3c69783d18e140bca5e62d751981ad2ea10f9a9cef47f	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-24 06:52:15.377+00	2026-08-23 18:52:15.379+00
934a2cbf-e307-4870-8422-65d62cee7944	add25838b918a53d4bf84d227871d1f879d02cf60b14f4876fa9a86b2822c51d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 09:36:40.254+00	2026-08-28 21:36:40.263+00
40d01588-c809-4d95-b63c-344720723a2f	34b773bc21dbe4f42e809175030f750420437c4495b2046dd4468e95c2a721cd	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 10:59:54.692+00	2026-08-28 22:59:54.693+00
1b8c8c5f-43c0-44d3-a13b-42ce19ff9b4e	9e46c7ee757fe6b32be809111b3ad3828be6ffb0b974b14d89a0315c7dbc6d1e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 11:04:11.772+00	2026-08-28 23:04:11.777+00
deaaf251-0348-4e47-8795-3b9c6e44af41	c3ec189ca63c55c82da0f1cf36a942df0c756ac0c52f3b5e9ada883fd0ae2b34	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 11:07:34.984+00	2026-08-28 23:07:34.998+00
1b0519d2-6d37-4727-8a52-6fc32562f4c8	47fa47cb36c1e74c6070c79b4590a3c46965eea7b09123506c92da7146fc3ce5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 13:54:21.557+00	2026-08-29 01:54:21.559+00
9c1517de-b069-471c-a351-755d42b7a57a	ef2cda3e51ad537cd789ebeb26e37d720135cb98acd6b3e3fe0510aa7215017a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 14:07:50.245+00	2026-08-29 02:07:50.247+00
8fc9dc3e-22df-4491-919a-fbb4eb5647e7	afc6ed0b95911c31066521872794191ab9b18ad6fa22a4ccfe609f05c63c133c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 14:12:06.997+00	2026-08-29 02:12:06.998+00
79c8be41-e018-4dfc-acc0-2ac267b0b69d	583ad705d113cda5638f3b32078c94d93ec7602f75bd1b6c5a48dc21bf833fb7	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 14:18:34.526+00	2026-08-29 02:18:34.527+00
e5972101-4cbe-46d4-b924-a7010bddcb97	115a9ca0104ee613f7fe68f33bd1b2a1b3f105feba08e696d48e18bcac58859c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 14:23:04.452+00	2026-08-29 02:23:04.454+00
a65cfb87-5f61-48b3-85dc-0366e87d4bed	5a45e830bf67945dbf5ed4455af7aafd7bdb0f629b6353605d564c8caa1c0440	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-29 14:23:08.269+00	2026-08-29 02:23:08.27+00
fc513a9e-3b36-4440-9eb4-6b1ef1cbe245	7d4cb35cf39aa863807362e67c94fb61b8bf306a25a8e6987c89d01c2469c087	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-30 07:24:39.442+00	2026-08-29 19:24:39.445+00
59ed0113-70b4-4a50-9d6a-beda4c78cc6a	0f645ed0d6079bd2117a6e4a8f41ec5359bbaed581d9d53c813a4a0ac889b2cb	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-30 07:51:00.056+00	2026-08-29 19:51:00.058+00
5789367e-a435-4f78-879b-9ff1aae81113	0bae9ae204690bf4f94286b1ed39cb4cb99c86ffd17eb87e779613241deadbd2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-30 07:52:12.038+00	2026-08-29 19:52:12.038+00
a15f790c-b8a2-4514-9a03-6e1d4e02e71b	5aa4873783b78d55e3c1d267cbeb97a001f8084fdfb3fcc6cc2c5f83457f8aba	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-30 07:53:51.796+00	2026-08-29 19:53:51.798+00
ee3343b9-2c61-41f2-91ed-547c6c780a8d	948af6d3d8b71505e10d4fc6cc81474dc1fe45920a70cdd0b0079e0ba83d71e5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-30 08:28:57.791+00	2026-08-29 20:28:57.793+00
16a181c7-cf93-437d-85e5-1a7fe847f638	0a8f3de15befe5c6c875ce32a4ee6b0c825fbdab073eb107bee87f71b51517df	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-08-30 08:32:22.547+00	2026-08-29 20:32:22.548+00
21b3b843-66e3-45f5-b32c-d57da7627a16	f664267c46cfc4100cd58c3cb122aa07db110068731c2475f28d997fb8b908ef	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-01 08:54:19.588+00	2026-08-31 20:54:19.59+00
c8d4c7d0-c628-4c00-9739-bc0cc893d9a8	146c0951ec60b3101a193751e4e144c4ebf794b9c3673044aa6cba4caab8e4de	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 09:44:14.436+00	2026-09-02 21:44:14.438+00
0a9df378-038a-436e-b01f-d01677dc68b6	7d7a6e7898eb23d1a566dc48163a50c06174f2d3aebf76948916f7bd44e2ebe6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 09:45:15.361+00	2026-09-02 21:45:15.374+00
89ee1d0a-8b5b-4c0e-8e5b-b38cc8670f9b	126657675bb352cffb40b2e0ba73e55fddb35a57f55bb7a8c22862d96f1d02ed	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 09:45:25.143+00	2026-09-02 21:45:25.157+00
192b50d4-2418-4ae8-98ce-3a3627747add	1cd4e3b7fcdb5f5ba40460049bd86ccf84da4788f6c7b848c5da5c3fe796b429	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 09:45:31.076+00	2026-09-02 21:45:31.089+00
7d93907c-8fa5-462e-b060-2b689b11c42f	e6fcf8764ae5c9adab38f86172c48bf404f657c647a3a167bb77cb5ed9e0fc04	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:20:51.981+00	2026-09-02 22:20:51.984+00
db0e2f52-97fc-4b6b-accc-b0a05f74e8c7	52348e46156dcc55c99d4808d6b4fd070cf9452ac9451b88e7944baeb20c80fb	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:21:02.176+00	2026-09-02 22:21:02.179+00
01c50fb6-e400-4141-b7d6-0a6ae1a10470	036be05072b517c69cb0897ab4e03e86e57bc6b03bcba4ff717ab0fc8399e99d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:21:06.995+00	2026-09-02 22:21:06.999+00
b3a8e142-585c-4e8e-b42a-d16543ff274b	1684d3fe0d284e5b4c5f61b98dbb874942f28c9884e858e7ffea05b9adac8892	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:24:12.205+00	2026-09-02 22:24:12.207+00
5cbd6a00-8612-458c-a63b-6dc6f68e610b	83eb6a0cd90dbfe3a315999e516d1cbc37b47c422227ddc1b3566292e5cd6598	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:24:34.429+00	2026-09-02 22:24:34.43+00
6b3a5072-e4a8-485d-a854-d7f993fd4295	8e1308710e97f17539edffbc4b03f4f5aaa503c68a279f12cc1651544819c439	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:25:34.508+00	2026-09-02 22:25:34.509+00
9f9d7d42-ff37-4ca5-ba62-be39420ef7ce	a0165697eb41fc3e49ab8e790e66bf35f2346e700c163ad90ee1d2d603b26dcf	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:25:53.019+00	2026-09-02 22:25:53.02+00
82d75d0c-663d-4961-b17b-756a32eb5b5e	c0e41f1b5ae0778436544a8430af0bd9ac43492cf270aa32b54e785d590f1366	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:27:36.503+00	2026-09-02 22:27:36.504+00
571f781c-b75e-47e3-9dd7-4a523923a5fc	3b70be274f06873c0c613b026829e086da1b5d7af07ee2f1c4c309a375ff1711	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:45:57.621+00	2026-09-02 22:45:57.623+00
483359a4-dfdb-4948-ade1-38014ee3155b	cdeaef7cd950e9682f3cfb0154374479e37a18289fbae469cb80d69096a13028	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-03 10:46:29.544+00	2026-09-02 22:46:29.546+00
07c33300-d64a-4f08-8bae-3087ee5f1f6c	39fa468135c601adbe9fec0033c1a31924d9760f529f8ecee03c05799c77ffce	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-18 10:15:32.782+00	2026-09-17 22:15:32.784+00
2f9110a4-3031-4b1d-adf9-697f87e981e3	7ea1ed79a26331a8a4e1a7525008657ba218c006c0781360c9fb0df9957e38fd	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-18 10:23:50.77+00	2026-09-17 22:23:50.771+00
d10c8278-c496-4b07-aa06-398d9efc79b1	52e1fae0cedc8cf8d66cde6568983d6c57dd0a3bebe27e6279a38accc8329924	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 08:32:41.389+00	2026-09-28 20:32:41.391+00
0383f618-e408-4dc4-aa50-5a696982e5c3	b9ca78ed9578328e64c9db13aaeb1310fa816bdce41abc34063dabb87788f574	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:16:08.952+00	2026-09-28 22:16:08.953+00
3e0e194e-4315-4e3d-a6ce-b94156cb0b07	476c50d2af562d60d49e6bf5f57391299542f4b04081f144d1722179ccf3e9b2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:19:28.276+00	2026-09-28 22:19:28.278+00
e6bd45a3-959d-48b3-bd70-1e8573ea1bf6	3f452881bdcfef69c7497d742ac364fa616d66d9e665f7aeedde911c69ad5309	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:19:38.005+00	2026-09-28 22:19:38.006+00
6f11d0c0-8087-498d-958a-214b8f2270ae	9dc9fc46651892be764bacd3b0170562a4f51fa53bbbbad5d339679147d4a02a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:22:47.277+00	2026-09-28 22:22:47.278+00
ae20ea2c-be5c-4120-af08-a2f47a86bf05	504d830c54bd67e0b8cb5a2f69455c4f6bfb68181b53306c8b96e1e22bde1869	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:39:22.345+00	2026-09-28 22:39:22.347+00
54d54ac1-fbe0-42d9-b039-e143567ba578	702161ee08d32871abee49c80c051d41872874e36bb74f89b76b69601801d9e0	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:45:13.51+00	2026-09-28 22:45:13.511+00
97318cdd-4476-4860-86f6-9a0ced50f03e	78782b925560c59e2e44cb6c746f3a3eaf065ceaa4ced226e9036c20ea6d849c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:49:19.366+00	2026-09-28 22:49:19.368+00
75cac83e-f56a-4191-af25-d05a333e86d7	c3e6e158cb888e062c12e2f9f09e0d8a4d1646dac709a5f0c21e450fcacc48cc	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 10:57:12.536+00	2026-09-28 22:57:12.537+00
a449f949-324e-4fd4-b8e2-cc724d9f964a	1862cc79c5cc087b451c7b71c87fbc42e8c67fe8ffa36aee49fd6170176c5cb8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 13:13:55.239+00	2026-09-29 01:13:55.24+00
306aa4ea-043c-4ffa-8f2b-3fae18d75c92	6b131abb78f96e7c1d9d6a2340340908d822e7437b054cabe62e87e24afa20d6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-29 13:17:21.952+00	2026-09-29 01:17:21.957+00
a0689645-c1b5-4cde-a14e-18e48423f193	3caa8310d73185c0f327f9defd20037615292895044dca92433cf8eb0de0e0d5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-30 13:28:49.273+00	2026-09-30 01:28:49.275+00
2afe9ec5-c483-403c-8eca-6153ea7e8ae0	30751ffdea30efd69e06be05dcedc0ba38506e7da0216aaa36bca7a7baa45d64	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:12:34.034+00	2026-10-01 20:12:34.035+00
09213073-e729-40c4-b549-947f2a0ebe24	aaac2623308b25826e41f09bab48e34c2c3fdaf3d89f36df812bd99c52a6756a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:15:27.825+00	2026-10-01 20:15:27.83+00
f46ba50e-449e-498a-bf07-2fa357814a7c	a26e1fa34bae595921310f6036dc67c0e16be368f818ed76f35d087ea0289714	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:18:16.03+00	2026-10-01 20:18:16.031+00
4cee8a1b-f692-4cbc-a7f0-e9c7c243de1f	158944450195a1fdae7ed6062ed6d3a87dfacb1b03266b3be458d1b1e5f048a1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:19:01.631+00	2026-10-01 20:19:01.632+00
c1e7d5bd-8989-4e30-9880-488c1e4339e1	2d1595f7a6e66b408fb8504ba2e726ee471109902469a4efc823224f8246c7d5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:19:29.875+00	2026-10-01 20:19:29.877+00
3298e5b8-d1f3-4bdf-be53-fc9d5a6ef4bd	0560fde383b06db775416f4d2d1683af509dedbbc75487bff32e369ad889d092	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:20:16.81+00	2026-10-01 20:20:16.812+00
14948683-ee0f-4e03-a3a1-d277461771f8	04cc679672db8d1f688fc36a656f6deec62a535613a03f51a54bdf9134a9c7fe	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-02 08:21:10.529+00	2026-10-01 20:21:10.531+00
e7242387-4616-42f5-8ea4-0b07e050af52	d26bdcd269b385a5aba6ca1855a6282aed7816748e343c9b4cdd4acfec334a53	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-05 12:23:54.503+00	2026-10-05 00:23:54.505+00
5c7a5f0f-0b70-480d-93b0-79923ed92ff0	f7d071115e4a3eef7ab1753e54f95d86943f4f0dee785aa5f387fbd07a2c1b1d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-10-06 08:00:41.005+00	2026-10-05 20:00:41.007+00
\.


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.admin_users (id, username, password_hash, status, created_at, updated_at, role) FROM stdin;
7d96c1bc-7329-413f-94c6-1c2f021eaed3	mariano	scrypt$16384$8$1$/Ppj0GrLTZJx1s6mokbVoQ==$E9dyHaMlBU9PLRN9mYdkHkprr7MCQtDZb/NI+pYZSYH0Ao7iyx6yn9exlQmrJtj99ZJL+DREcClhBgVENXvEsA==	ACTIVE	2026-08-21 21:12:09.501+00	2026-08-21 21:12:09.501+00	ADMINISTRATOR
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, before, after, metadata, created_at) FROM stdin;
c431804f-6e6f-4fac-a4d3-f7649fc0fd99	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	e0811a68-dd31-4be0-be6c-88be271765d7	\N	{"dni": "900000001", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ALBARRACIN", "birthDate": null, "firstName": "MICAELA"}	{"dni": "900000001", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ALBARRACIN", "birthDate": null, "firstName": "MICAELA"}	\N	2026-09-02 22:24:12.249+00
7b9da19e-9d40-4653-9b16-f5b513e70d77	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	5f9946ba-3eea-444c-b8aa-664d7686fe6d	\N	{"dni": "900000002", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ARMOA", "birthDate": null, "firstName": "CRISTIAN"}	{"dni": "900000002", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ARMOA", "birthDate": null, "firstName": "CRISTIAN"}	\N	2026-09-02 22:24:12.295+00
3325ba8d-924d-4c0d-883b-a8506424a158	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	bd4533b9-c38a-4df2-b4b9-e6a0c8ced4bb	\N	{"dni": "900000003", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "BARBOZA", "birthDate": null, "firstName": "GUSTAVO"}	{"dni": "900000003", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "BARBOZA", "birthDate": null, "firstName": "GUSTAVO"}	\N	2026-09-02 22:24:12.321+00
fbe6e349-6637-4501-875b-695c78306bef	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	088e7435-5cea-4497-a371-6b11fce3c045	\N	{"dni": "900000004", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "BAY", "birthDate": null, "firstName": "LAURA"}	{"dni": "900000004", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "BAY", "birthDate": null, "firstName": "LAURA"}	\N	2026-09-02 22:24:12.357+00
3866c9e7-6046-4bd3-84f9-2bc93543156c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	c9c8f310-d002-4085-9e15-d05f99db5f0a	\N	{"dni": "900000005", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "BENITEZ", "birthDate": null, "firstName": "JUANA"}	{"dni": "900000005", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "BENITEZ", "birthDate": null, "firstName": "JUANA"}	\N	2026-09-02 22:24:12.415+00
65e2c749-3963-46c9-8a02-588e67a17853	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	630d576f-5360-40b8-95ce-965a4f9a41dc	\N	{"dni": "900000006", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "CABALLERO", "birthDate": null, "firstName": "AGOSTINA MICAELA"}	{"dni": "900000006", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "CABALLERO", "birthDate": null, "firstName": "AGOSTINA MICAELA"}	\N	2026-09-02 22:24:12.459+00
4c570976-3cce-4d1a-a70c-a16c11c2adca	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	abf306d4-83d7-4467-aa81-6cda65fe4c1d	\N	{"dni": "900000007", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "CACERES FERNANDEZ", "birthDate": null, "firstName": "AGOSTINA"}	{"dni": "900000007", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "CACERES FERNANDEZ", "birthDate": null, "firstName": "AGOSTINA"}	\N	2026-09-02 22:24:12.506+00
e5767cf3-2f61-4636-99d7-661eaf85d6eb	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	62de9f40-7027-4b13-997f-1ce9106757ce	\N	{"dni": "900000008", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "CARRERA", "birthDate": null, "firstName": "MIA"}	{"dni": "900000008", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "CARRERA", "birthDate": null, "firstName": "MIA"}	\N	2026-09-02 22:24:12.541+00
0174ee9c-64f0-47be-aeff-4db9e606d274	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	1ca2cd22-ac1c-4627-a0f4-8a1ce8bce0be	\N	{"dni": "900000009", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "CASTILLO", "birthDate": null, "firstName": "CAMILA"}	{"dni": "900000009", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "CASTILLO", "birthDate": null, "firstName": "CAMILA"}	\N	2026-09-02 22:24:12.589+00
08d0699d-4e7e-4164-b971-34d59fd61795	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	cd7321aa-45a3-4fa8-aa96-79f146db1290	\N	{"dni": "900000010", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "CENTURION", "birthDate": null, "firstName": "YAMILA"}	{"dni": "900000010", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "CENTURION", "birthDate": null, "firstName": "YAMILA"}	\N	2026-09-02 22:24:12.63+00
2120acad-1f16-4ace-87a2-f3f8cc470336	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	7328ff49-6386-41f6-ac7a-7e7808697bd6	\N	{"dni": "900000011", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "D AUGERO", "birthDate": null, "firstName": "CLAUDIA BEATRIZ"}	{"dni": "900000011", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "D AUGERO", "birthDate": null, "firstName": "CLAUDIA BEATRIZ"}	\N	2026-09-02 22:24:12.721+00
0130cf46-f656-42a3-a20f-ce6503874438	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	6e71dbbc-029d-45d6-affc-c68fa0e5ccd2	\N	{"dni": "900000012", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DE LOS SANTOS", "birthDate": null, "firstName": "MELISA"}	{"dni": "900000012", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DE LOS SANTOS", "birthDate": null, "firstName": "MELISA"}	\N	2026-09-02 22:24:12.786+00
6b62d737-0af0-496f-9603-bb02ade6d3d6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	f3ab44dd-f9c9-4a0a-8297-954e9fb04117	\N	{"dni": "900000013", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DE MICHIELIS", "birthDate": null, "firstName": "AZUL"}	{"dni": "900000013", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DE MICHIELIS", "birthDate": null, "firstName": "AZUL"}	\N	2026-09-02 22:24:12.828+00
d34886c4-839c-45e0-af12-fb3620e19541	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	dc44e246-c8db-48b2-9710-4ab57615b347	\N	{"dni": "900000014", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DEL VALLE", "birthDate": null, "firstName": "AITANA NICOL"}	{"dni": "900000014", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DEL VALLE", "birthDate": null, "firstName": "AITANA NICOL"}	\N	2026-09-02 22:24:12.882+00
c7eebf90-5926-476a-abce-f3db708b52c1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	eb1a1c31-27f5-454d-b23e-83f171d59f6b	\N	{"dni": "900000015", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DELLAGNOLO", "birthDate": null, "firstName": "CAMILA"}	{"dni": "900000015", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DELLAGNOLO", "birthDate": null, "firstName": "CAMILA"}	\N	2026-09-02 22:24:12.921+00
df5087e8-95f9-4f03-b72f-1e7c726c5ad8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	e7438a66-db50-4610-9fa8-ec00833ed1f0	\N	{"dni": "900000016", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DIAZ", "birthDate": null, "firstName": "AYELEN"}	{"dni": "900000016", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DIAZ", "birthDate": null, "firstName": "AYELEN"}	\N	2026-09-02 22:24:12.961+00
3e2659a1-0ce0-4094-a454-2a9c8c3d8500	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	dd8b06a2-f18b-4a36-b91e-62cd3bb09cf8	\N	{"dni": "900000017", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DOMINGUEZ", "birthDate": null, "firstName": "NAHUEL"}	{"dni": "900000017", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DOMINGUEZ", "birthDate": null, "firstName": "NAHUEL"}	\N	2026-09-02 22:24:13.055+00
970683a8-9ff1-4249-a5f0-dfcdec72049b	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	aebc5d6c-914a-49f6-87b8-3354105f5103	\N	{"dni": "900000018", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "DUARTE", "birthDate": null, "firstName": "GUILIANA"}	{"dni": "900000018", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "DUARTE", "birthDate": null, "firstName": "GUILIANA"}	\N	2026-09-02 22:24:13.098+00
fcda8875-32b1-4d7f-addf-7e909cfac56f	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	332b258e-69a8-4cb7-b1cc-75971f504cd3	\N	{"dni": "900000019", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ELLI", "birthDate": null, "firstName": "JOAQUINA"}	{"dni": "900000019", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ELLI", "birthDate": null, "firstName": "JOAQUINA"}	\N	2026-09-02 22:24:13.141+00
9d9e594b-b170-40b1-ac0d-1d9922d60ccc	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	2047b20c-6313-4ba5-994b-12b45f3a23ac	\N	{"dni": "900000020", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ENCISO", "birthDate": null, "firstName": "PATRICIO"}	{"dni": "900000020", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ENCISO", "birthDate": null, "firstName": "PATRICIO"}	\N	2026-09-02 22:24:13.174+00
fa05115b-d014-440e-bee6-6a621ac4d3c1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	d18fc40a-f574-44de-8d14-6fa56f77b179	\N	{"dni": "900000021", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "FERNANDEZ", "birthDate": null, "firstName": "LETICIA AILEN"}	{"dni": "900000021", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "FERNANDEZ", "birthDate": null, "firstName": "LETICIA AILEN"}	\N	2026-09-02 22:24:13.215+00
ff83fe27-2fb5-40ba-b439-4c039f45af19	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	8576617b-4be5-4548-9125-cd2888b9f11c	\N	{"dni": "900000022", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "FLEITAS", "birthDate": null, "firstName": "TERESA"}	{"dni": "900000022", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "FLEITAS", "birthDate": null, "firstName": "TERESA"}	\N	2026-09-02 22:24:13.254+00
30dac678-c5f2-4f38-9362-d9ff057351e5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	4ab8b2c4-86d0-4e63-b14c-7b4ef7db62f7	\N	{"dni": "900000023", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GALEANO", "birthDate": null, "firstName": "ANAPAULA"}	{"dni": "900000023", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GALEANO", "birthDate": null, "firstName": "ANAPAULA"}	\N	2026-09-02 22:24:13.292+00
0523e8cf-364b-4cd4-bdd9-8065b93063a4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	af5dabec-f6a6-4cea-b71b-924ce22443c8	\N	{"dni": "900000024", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GALEANO", "birthDate": null, "firstName": "SILVIA"}	{"dni": "900000024", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GALEANO", "birthDate": null, "firstName": "SILVIA"}	\N	2026-09-02 22:24:13.322+00
46be855c-145c-4259-8c2e-61c7703f4053	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	3afe25e0-e4f6-499a-97c9-558179fbf02b	\N	{"dni": "900000025", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GAUTO", "birthDate": null, "firstName": "FRANCESCA"}	{"dni": "900000025", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GAUTO", "birthDate": null, "firstName": "FRANCESCA"}	\N	2026-09-02 22:24:13.36+00
a8f6f86e-0f39-4d79-91c2-dd435af361d3	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	2966dca5-5db5-4180-846e-aee8a3d8550b	\N	{"dni": "900000026", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "OBREGON", "birthDate": null, "firstName": "GERARDO"}	{"dni": "900000026", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "OBREGON", "birthDate": null, "firstName": "GERARDO"}	\N	2026-09-02 22:24:13.39+00
316ea3e9-de57-4836-9c58-ffffdc0c891d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	0527d151-0fd0-48b5-ae9f-26d26cd19f3b	\N	{"dni": "900000027", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GIMENEZ", "birthDate": null, "firstName": "GABRIELA"}	{"dni": "900000027", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GIMENEZ", "birthDate": null, "firstName": "GABRIELA"}	\N	2026-09-02 22:24:13.428+00
e2d408a6-8953-4f01-8da0-627b7e8e53c5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	9199d897-0441-41ef-9396-67575b644e7e	\N	{"dni": "900000028", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GIMENEZ", "birthDate": null, "firstName": "KIARA"}	{"dni": "900000028", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GIMENEZ", "birthDate": null, "firstName": "KIARA"}	\N	2026-09-02 22:24:13.471+00
839f92b7-56c2-4200-a158-f41601acbd82	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	51c0bc75-327c-41f7-bcd9-2c1dbe7f83e5	\N	{"dni": "900000029", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MIQUEL", "birthDate": null, "firstName": "GISSELLA"}	{"dni": "900000029", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MIQUEL", "birthDate": null, "firstName": "GISSELLA"}	\N	2026-09-02 22:24:13.505+00
81e37c1b-36d4-43ad-a1d7-9a4259a45e30	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	6580c661-c4b4-4c27-9ac0-53c62e941754	\N	{"dni": "900000030", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GLERIA", "birthDate": null, "firstName": "PATRICIA"}	{"dni": "900000030", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GLERIA", "birthDate": null, "firstName": "PATRICIA"}	\N	2026-09-02 22:24:13.534+00
c308c84b-94b1-4d3b-8a67-8d1821c9b6a3	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	a2baa8f1-d52f-4263-aeb2-647c3f2f8e6b	\N	{"dni": "900000031", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GOMEZ", "birthDate": null, "firstName": "FEDERICO ADRIAN"}	{"dni": "900000031", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GOMEZ", "birthDate": null, "firstName": "FEDERICO ADRIAN"}	\N	2026-09-02 22:24:13.576+00
59f595b5-c626-406b-afec-f8f9c92841e0	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	5fe8147b-071b-49b8-982d-9841570d3df4	\N	{"dni": "900000032", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "GONZALEZ", "birthDate": null, "firstName": "MONICA"}	{"dni": "900000032", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "GONZALEZ", "birthDate": null, "firstName": "MONICA"}	\N	2026-09-02 22:24:13.614+00
527f789a-54d1-46b3-b210-eabb8e11286e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	b0364a68-55f7-45bb-a2f8-121b0330fdeb	\N	{"dni": "900000033", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "INSAURRALDE", "birthDate": null, "firstName": "VANESA"}	{"dni": "900000033", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "INSAURRALDE", "birthDate": null, "firstName": "VANESA"}	\N	2026-09-02 22:24:13.66+00
704355d1-6946-42ee-865a-c77fb28c3103	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	cf232c58-308a-419d-a714-b5902b143f2c	\N	{"dni": "900000034", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ISASI", "birthDate": null, "firstName": "YASLIN"}	{"dni": "900000034", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ISASI", "birthDate": null, "firstName": "YASLIN"}	\N	2026-09-02 22:24:13.699+00
23916f86-ae44-430f-940a-7d54e8044dbe	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	e42a187e-ef04-45f9-9fd8-8c24a5fcfcdf	\N	{"dni": "900000035", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "LAGRAÑA", "birthDate": null, "firstName": "EUGENIA ROSELY"}	{"dni": "900000035", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "LAGRAÑA", "birthDate": null, "firstName": "EUGENIA ROSELY"}	\N	2026-09-02 22:24:13.77+00
e77a3466-e7ed-4185-a3e7-9e3467181cd4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	4ba9a189-06e0-4787-8dd3-edf55ec58a22	\N	{"dni": "900000036", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "LEPEZ", "birthDate": null, "firstName": "ARIANA"}	{"dni": "900000036", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "LEPEZ", "birthDate": null, "firstName": "ARIANA"}	\N	2026-09-02 22:24:13.857+00
38443ef2-99c3-4d8e-b237-0c561f9f88e7	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	e9b4b1f5-1d06-4ad3-b102-76554c3d5581	\N	{"dni": "900000037", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "LEYES", "birthDate": null, "firstName": "OMAR"}	{"dni": "900000037", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "LEYES", "birthDate": null, "firstName": "OMAR"}	\N	2026-09-02 22:24:13.9+00
a2caf4b4-604a-4887-8c1f-c249b7d6d0a4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	9a062ed6-c4fe-4cf6-b590-8a04240d57fd	\N	{"dni": "900000038", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "LO CURCIO", "birthDate": null, "firstName": "MARTINA"}	{"dni": "900000038", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "LO CURCIO", "birthDate": null, "firstName": "MARTINA"}	\N	2026-09-02 22:24:13.96+00
2e494733-59d5-445d-a28b-d6aef12bfb30	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	15d4419b-004a-4a05-9130-bff521459113	\N	{"dni": "900000039", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "LUQUE", "birthDate": null, "firstName": "ANDREA ISABEL"}	{"dni": "900000039", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "LUQUE", "birthDate": null, "firstName": "ANDREA ISABEL"}	\N	2026-09-02 22:24:14.007+00
9f77b862-63aa-4617-a0a6-56a5341dbf9c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	595b3f8d-4997-478f-8bd9-f6f10ac6fe00	\N	{"dni": "900000040", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MARTINEZ", "birthDate": null, "firstName": "STEFANIA"}	{"dni": "900000040", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MARTINEZ", "birthDate": null, "firstName": "STEFANIA"}	\N	2026-09-02 22:24:14.053+00
c868f423-a4ac-40f7-be2a-4b77983ca7c0	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	3df5c6f2-82e5-4b28-a2ed-310573216eaa	\N	{"dni": "900000041", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MATTEO", "birthDate": null, "firstName": "GIULIANA"}	{"dni": "900000041", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MATTEO", "birthDate": null, "firstName": "GIULIANA"}	\N	2026-09-02 22:24:14.081+00
8c2e7fae-e4e3-4402-a11c-64c306322fc8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	354818ea-b773-4be4-92d5-548f2fc48f82	\N	{"dni": "900000042", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MEDINA", "birthDate": null, "firstName": "ERIK"}	{"dni": "900000042", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MEDINA", "birthDate": null, "firstName": "ERIK"}	\N	2026-09-02 22:24:14.122+00
d4ab5f96-3cb2-4604-8ae0-3ca9eed54a13	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	4266485a-8c0a-41b5-bc21-8b3c0b5c0123	\N	{"dni": "900000043", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MEDINA PATIÑO", "birthDate": null, "firstName": "YANI"}	{"dni": "900000043", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MEDINA PATIÑO", "birthDate": null, "firstName": "YANI"}	\N	2026-09-02 22:24:14.16+00
0a713904-daac-47ad-bc64-56c82235de36	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	394dab71-975b-44a5-97a1-9f2771beb52e	\N	{"dni": "900000044", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MONTIEL", "birthDate": null, "firstName": "KAREN"}	{"dni": "900000044", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MONTIEL", "birthDate": null, "firstName": "KAREN"}	\N	2026-09-02 22:24:14.243+00
d256a003-8772-4b3e-9a14-3b4822c2583e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	2dee74ee-8d96-435d-9919-796132c2c721	\N	{"dni": "900000045", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MONYO", "birthDate": null, "firstName": "LAURA"}	{"dni": "900000045", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MONYO", "birthDate": null, "firstName": "LAURA"}	\N	2026-09-02 22:24:14.325+00
ac8eba19-d5f6-43e4-a160-b81fb2b73762	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	6b13f068-8818-4a06-afa1-0f823c14c584	\N	{"dni": "900000046", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "MORCILLO", "birthDate": null, "firstName": "ALEJANDRA"}	{"dni": "900000046", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "MORCILLO", "birthDate": null, "firstName": "ALEJANDRA"}	\N	2026-09-02 22:24:14.416+00
11dfc3a6-bee6-4bed-b9bc-4920745ae42f	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	27df3a27-a07e-4a5b-8b17-27c3cc47ae55	\N	{"dni": "900000047", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "OJEDA", "birthDate": null, "firstName": "JORGE"}	{"dni": "900000047", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "OJEDA", "birthDate": null, "firstName": "JORGE"}	\N	2026-09-02 22:24:14.438+00
b3367e59-b654-4b69-8abc-784e688c2bfd	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	43bb40a7-3e58-417c-b486-0c4ddb7822ff	\N	{"dni": "900000048", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ORRABALIS", "birthDate": null, "firstName": "ELIDA"}	{"dni": "900000048", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ORRABALIS", "birthDate": null, "firstName": "ELIDA"}	\N	2026-09-02 22:24:14.471+00
f0a9c13c-2dfb-453f-83a0-b1acff502145	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	90f5e1a8-2c50-404a-bacc-a85b6546541e	\N	{"dni": "900000049", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "PENAYO", "birthDate": null, "firstName": "NAHIARA"}	{"dni": "900000049", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "PENAYO", "birthDate": null, "firstName": "NAHIARA"}	\N	2026-09-02 22:24:14.511+00
9c598596-b3f6-4858-9344-c2c1687e460e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	578ec62c-5e6f-4ad0-8d28-f2a4117c4aba	\N	{"dni": "900000050", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "PERALTA", "birthDate": null, "firstName": "PRISCILA"}	{"dni": "900000050", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "PERALTA", "birthDate": null, "firstName": "PRISCILA"}	\N	2026-09-02 22:24:14.561+00
8d43ff8c-15f2-4a2c-ae3c-f4d5d15fd6db	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	0185c457-daad-4f7b-86cd-132fe29eb79b	\N	{"dni": "900000051", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "QUINTANA", "birthDate": null, "firstName": "LAURA"}	{"dni": "900000051", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "QUINTANA", "birthDate": null, "firstName": "LAURA"}	\N	2026-09-02 22:24:14.607+00
94a6ea67-f368-48b1-9fda-566e3c2e94be	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	16443c47-5f93-49d5-8fc2-0b8e8eed17a6	\N	{"dni": "900000052", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RAMIREZ", "birthDate": null, "firstName": "CELESTE"}	{"dni": "900000052", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RAMIREZ", "birthDate": null, "firstName": "CELESTE"}	\N	2026-09-02 22:24:14.638+00
6843bd77-4d84-4b3a-9b15-528b9360b411	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	93eb3719-9602-4843-bded-dd9b84d8fc85	\N	{"dni": "900000053", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RAMOA", "birthDate": null, "firstName": "TATIANA"}	{"dni": "900000053", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RAMOA", "birthDate": null, "firstName": "TATIANA"}	\N	2026-09-02 22:24:14.669+00
bba922a1-51ef-46a8-aef0-ce770363703a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	91b5b534-5e64-46fe-8cf2-af0d6cd19375	\N	{"dni": "900000054", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "REYES", "birthDate": null, "firstName": "MAIA"}	{"dni": "900000054", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "REYES", "birthDate": null, "firstName": "MAIA"}	\N	2026-09-02 22:24:14.701+00
8d39cb9c-9a97-4503-9582-db3d1a433259	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	bf22c095-e25d-45d8-bec9-c162e867c7a5	\N	{"dni": "900000055", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "REYES", "birthDate": null, "firstName": "MAXI"}	{"dni": "900000055", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "REYES", "birthDate": null, "firstName": "MAXI"}	\N	2026-09-02 22:24:14.731+00
111bc361-0a81-4de4-b3a5-12f257a5f3db	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	644fcc38-1091-4820-af7d-0ea909f2f7d3	\N	{"dni": "900000056", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RIGONATO", "birthDate": null, "firstName": "ANDREA"}	{"dni": "900000056", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RIGONATO", "birthDate": null, "firstName": "ANDREA"}	\N	2026-09-02 22:24:14.766+00
418368ef-d61e-4619-aeb7-560b3164baa2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	02e64ebe-65ee-419e-a706-e27ce4705d26	\N	{"dni": "900000057", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RIOS", "birthDate": null, "firstName": "MARIANA"}	{"dni": "900000057", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RIOS", "birthDate": null, "firstName": "MARIANA"}	\N	2026-09-02 22:24:14.797+00
f687974d-7c84-478b-a0eb-c980659c4233	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	3000ba63-6b94-4117-ac49-b864162e5c98	\N	{"dni": "900000058", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RIVAS", "birthDate": null, "firstName": "KARLA AGOSTINA"}	{"dni": "900000058", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RIVAS", "birthDate": null, "firstName": "KARLA AGOSTINA"}	\N	2026-09-02 22:24:14.844+00
a3444272-7621-4637-90ed-ef1e8fa202a2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	eabdb8b6-3845-4fd0-b251-194ce48cc7d5	\N	{"dni": "900000059", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RIVERO", "birthDate": null, "firstName": "ROMINA"}	{"dni": "900000059", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RIVERO", "birthDate": null, "firstName": "ROMINA"}	\N	2026-09-02 22:24:14.875+00
c1366816-3c8c-4930-8804-8d540e689ca4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	639d4c47-7cdb-4d17-a606-46cd152dc99c	\N	{"dni": "900000060", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ROLDAN", "birthDate": null, "firstName": "RENATTA"}	{"dni": "900000060", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ROLDAN", "birthDate": null, "firstName": "RENATTA"}	\N	2026-09-02 22:24:14.907+00
1bf0884c-93c4-4311-a3f7-187185fe206e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	7f6b993b-3935-4a20-b017-75a8c8956f48	\N	{"dni": "900000061", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "RUIZ DIAZ", "birthDate": null, "firstName": "FLORENCIA"}	{"dni": "900000061", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "RUIZ DIAZ", "birthDate": null, "firstName": "FLORENCIA"}	\N	2026-09-02 22:24:14.944+00
6d3d64b1-27bf-4dc6-885b-f70121da8335	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	832092f8-877d-4980-81c8-3a992b980b23	\N	{"dni": "900000062", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "SILVERA", "birthDate": null, "firstName": "ILEANA"}	{"dni": "900000062", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "SILVERA", "birthDate": null, "firstName": "ILEANA"}	\N	2026-09-02 22:24:14.992+00
c623d16c-84c5-4408-9160-2fe1977f828b	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	c38fe8da-7530-42c4-bc42-257b2a3f947d	\N	{"dni": "900000063", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "SORAIRE", "birthDate": null, "firstName": "PAOLA"}	{"dni": "900000063", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "SORAIRE", "birthDate": null, "firstName": "PAOLA"}	\N	2026-09-02 22:24:15.038+00
1fa71dba-feff-435c-82b9-3b03d286651a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	4f2227bd-707f-4fbe-8531-649359533dac	\N	{"dni": "900000064", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "SOSA", "birthDate": null, "firstName": "LORENA"}	{"dni": "900000064", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "SOSA", "birthDate": null, "firstName": "LORENA"}	\N	2026-09-02 22:24:15.082+00
600ececa-4033-4914-afee-7b5bcdd89966	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	0525fe97-d116-4493-b08b-5e9406256a33	\N	{"dni": "900000065", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "VELAZQUEZ", "birthDate": null, "firstName": "NATALIA"}	{"dni": "900000065", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "VELAZQUEZ", "birthDate": null, "firstName": "NATALIA"}	\N	2026-09-02 22:24:15.123+00
90e876ec-d683-4452-ab18-fe6519fb46c5	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	03d84eb6-75ca-4c8e-b8a7-b1afa2506408	\N	{"dni": "900000066", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "VIERA", "birthDate": null, "firstName": "ANALIA"}	{"dni": "900000066", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "VIERA", "birthDate": null, "firstName": "ANALIA"}	\N	2026-09-02 22:24:15.161+00
b459eb7e-8af9-41db-9cf8-5fed500e5644	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	14c2fc1f-9bf8-44b5-8143-d38a5204f6e8	\N	{"dni": "900000067", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "VILLA", "birthDate": null, "firstName": "VALERIA"}	{"dni": "900000067", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "VILLA", "birthDate": null, "firstName": "VALERIA"}	\N	2026-09-02 22:24:15.202+00
86b7e55c-a046-45cc-a49c-9a044471ef2c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	331355b9-731b-4ae6-9e2d-a8de8c43c837	\N	{"dni": "900000068", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "VILLAGRA", "birthDate": null, "firstName": "LUCIANA"}	{"dni": "900000068", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "VILLAGRA", "birthDate": null, "firstName": "LUCIANA"}	\N	2026-09-02 22:24:15.232+00
762be7be-b197-4549-bd33-6359d3913353	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	8de58389-ee6e-4750-8e63-2cbd68647d78	\N	{"dni": "900000069", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "VILLAMAYOR", "birthDate": null, "firstName": "LORENA"}	{"dni": "900000069", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "VILLAMAYOR", "birthDate": null, "firstName": "LORENA"}	\N	2026-09-02 22:24:15.263+00
53f21f46-c1eb-472a-8f76-3578a794089a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	a0c222dc-ca48-46f8-ba14-e862c38ffd9f	\N	{"dni": "900000070", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ORTIZ", "birthDate": null, "firstName": "YANINA"}	{"dni": "900000070", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ORTIZ", "birthDate": null, "firstName": "YANINA"}	\N	2026-09-02 22:24:15.295+00
39054d68-4ed6-4197-bef7-933614505a4c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	STUDENT	dbd63745-e037-438b-a665-88df5347b07c	\N	{"dni": "900000071", "email": null, "phone": null, "status": "ACTIVE", "address": null, "lastName": "ZARACHO", "birthDate": null, "firstName": "ALEJANDRO"}	{"dni": "900000071", "email": null, "phone": null, "status": "INACTIVE", "address": null, "lastName": "ZARACHO", "birthDate": null, "firstName": "ALEJANDRO"}	\N	2026-09-02 22:24:15.345+00
4dec2b00-5d5b-45cd-9660-cad74bb5e44d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	a12f5acf-4754-479a-853c-15926c2dac92	\N	{"name": "Ladys Tango - Gabriela P.", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "38bfbac8-b451-4e00-ae80-9317a6628c17", "danceTypeId": "19e25d27-319e-4311-ab1f-389444d1e332"}	{"name": "Ladys Tango - Gabriela P.", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "38bfbac8-b451-4e00-ae80-9317a6628c17", "danceTypeId": "19e25d27-319e-4311-ab1f-389444d1e332"}	\N	2026-09-17 22:16:52.007+00
616aadd6-f674-4292-a82d-895b4e173441	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	28f1b214-f935-4bea-8a8c-a28789592bb0	\N	{"name": "Coreográfico Bachata en Pareja", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "a289ca41-3d4d-402a-9e50-68801ed393c2", "danceTypeId": "ffb7ba8f-2091-4eea-a83c-4e0e61f85d71"}	{"name": "Coreográfico Bachata en Pareja", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "a289ca41-3d4d-402a-9e50-68801ed393c2", "danceTypeId": "ffb7ba8f-2091-4eea-a83c-4e0e61f85d71"}	\N	2026-09-17 22:17:47.892+00
193b24be-100d-4fac-8ad2-24350d451d3d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	23888530-c53d-4c40-94ee-982518e5d2f6	\N	{"name": "Tango Inicial", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "38bfbac8-b451-4e00-ae80-9317a6628c17", "danceTypeId": "19e25d27-319e-4311-ab1f-389444d1e332"}	{"name": "Tango Inicial", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "38bfbac8-b451-4e00-ae80-9317a6628c17", "danceTypeId": "19e25d27-319e-4311-ab1f-389444d1e332"}	\N	2026-09-17 22:18:12.972+00
2bf77d61-0253-43ce-964f-2f20caea7522	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	db1e0e5e-c5e0-429e-aec3-4f28d406dad9	\N	{"name": "Fitdance + Axé", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "fcfd33ff-d0be-43bc-8440-1fb444c4eb33", "danceTypeId": "5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3"}	{"name": "Fitdance + Axé", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "fcfd33ff-d0be-43bc-8440-1fb444c4eb33", "danceTypeId": "5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3"}	\N	2026-09-17 22:18:46.356+00
5683d01d-3481-48ea-a200-a4f6ba7ca691	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	8da07d2d-b252-4618-9370-34f8ca23e93e	\N	{"name": "Bachata Pasos Sueltos", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "5e3dfae4-8670-4dfa-a351-d889551ab3e7", "danceTypeId": "ffb7ba8f-2091-4eea-a83c-4e0e61f85d71"}	{"name": "Bachata Pasos Sueltos", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "5e3dfae4-8670-4dfa-a351-d889551ab3e7", "danceTypeId": "ffb7ba8f-2091-4eea-a83c-4e0e61f85d71"}	\N	2026-09-17 22:19:11.824+00
0c0dece0-5247-49fb-9b8a-c2f545457f4c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	dbd5af21-ec55-4380-8ca1-d643a10d2003	\N	{"name": "Belly Dance Alternativo", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "297cc413-faec-4274-8de1-272f32231fa5", "danceTypeId": "5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3"}	{"name": "Belly Dance Alternativo", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "297cc413-faec-4274-8de1-272f32231fa5", "danceTypeId": "5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3"}	\N	2026-09-17 22:21:06.041+00
bb508cf2-c779-4329-b1e5-e733222d6a30	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	ACADEMY_CLASS	d06eb88b-a6e3-4cda-8bf9-5278455b3b7e	\N	{"name": "Bachata en Pareja", "level": "1", "status": "ACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "d38d5749-cf17-49ab-a9f9-af4078408cdc", "danceTypeId": "ffb7ba8f-2091-4eea-a83c-4e0e61f85d71"}	{"name": "Bachata en Pareja", "level": "1", "status": "INACTIVE", "capacity": 30, "schedules": [{"roomId": "7224e2cf-3eb5-4dcf-b086-aed42eabbff4", "endTime": "19:00", "dayOfWeek": "SUNDAY", "startTime": "18:00"}], "teacherId": "d38d5749-cf17-49ab-a9f9-af4078408cdc", "danceTypeId": "ffb7ba8f-2091-4eea-a83c-4e0e61f85d71"}	\N	2026-09-17 22:23:19.741+00
84ec13d8-9d39-49b2-a52a-8c0f572e311c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "ACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	\N	2026-09-28 22:06:10.848+00
6ce698ba-b499-420a-bff4-adde8d7925fe	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "ACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	\N	2026-09-28 22:06:11.617+00
73be4cdc-8f3f-49e2-8515-9945dffc5ad4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "ACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	\N	2026-09-28 22:06:47.917+00
a0763ed4-e9de-4a38-a755-ae738fc78dc6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "ACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	\N	2026-09-28 22:18:17.889+00
9362cca3-7aa8-4186-a0a4-970ae3a3759e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "ACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	\N	2026-09-28 22:18:19.368+00
4acc9603-4a00-48ec-abb3-111bde0d7bd2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "tarifa prueba 1", "amount": "33333.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "TARIFA PRUEBA", "amount": "0.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	\N	2026-09-28 22:18:28.981+00
821e6dd8-00be-48a9-8158-f751f1b9a15a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	13274251-a550-474b-a7f2-bf639d9d8097	\N	{"name": "TARIFA PRUEBA", "amount": "0.00", "status": "INACTIVE", "validTo": "2026-09-30", "validFrom": "2026-09-28"}	{"name": "TARIFA PRUEBA", "amount": "0.00", "status": "INACTIVE", "validTo": "2026-09-29", "validFrom": "2026-09-28"}	\N	2026-09-28 22:18:37.304+00
9699f5f5-260e-468c-bb89-2673bdd649cc	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	aa882452-96fa-4ace-90e5-b43b424968cf	\N	{"name": "Histórica - Árabe infantil - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Árabe infantil - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:28.346+00
c0a92eb1-e9c4-4650-af74-81ad97470f14	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	e459a08c-97b0-4afb-8d9b-d9ff81c10f47	\N	{"name": "Histórica - Árabe infantil - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Árabe infantil - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:28.379+00
f7251582-ee4d-42b4-aa17-cb0ff3c44762	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	5a80f542-151d-4047-85eb-2cfc9bcc3d9b	\N	{"name": "Histórica - Árabe infantil - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Árabe infantil - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:28.423+00
42128e03-b026-46b7-ac0b-91f1428b0db8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	7d5f0b87-464a-43f8-bea5-320bf5e1c0bd	\N	{"name": "Histórica - Árabe infantil - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	{"name": "Histórica - Árabe infantil - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	\N	2026-09-28 22:19:28.456+00
4c7565c0-12e3-4e2d-a9c4-e60e6db9ba8e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a76f171c-377e-4573-99a9-b6fd588a7abb	\N	{"name": "Histórica - Árabe infantil - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Árabe infantil - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:28.488+00
a687905e-572c-4137-bd24-6c66195124ac	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	c4b4c25b-eb7e-433e-934b-0cca6781b4f8	\N	{"name": "Histórica - Bachata en Pareja - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	{"name": "Histórica - Bachata en Pareja - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	\N	2026-09-28 22:19:28.517+00
17368e29-480b-485b-82c0-ad427ff6a039	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	364a71bb-c8cb-4dcc-884a-b2932034e9f6	\N	{"name": "Histórica - Bachata Pasos Sueltos - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	{"name": "Histórica - Bachata Pasos Sueltos - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	\N	2026-09-28 22:19:28.55+00
94edc9ce-5b00-42cf-b5a2-c6bd18cda335	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	e194c2af-4420-4b55-899f-a6b82592282d	\N	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:28.609+00
11eb6f2c-cf3d-4822-89cf-cf346f573ada	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	3dbdd5a1-cfb4-4a23-8fa8-27cca7ee2d07	\N	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $10.000", "amount": "10000.00", "status": "ACTIVE", "validTo": "2025-05-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $10.000", "amount": "10000.00", "status": "INACTIVE", "validTo": "2025-05-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:28.64+00
7e1a1595-564c-43e1-b688-504a24f67455	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	b431c0e1-78da-44f4-9a39-d3ce59dfe35e	\N	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-06-01"}	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-06-01"}	\N	2026-09-28 22:19:28.672+00
2a496175-7713-4b14-80e9-f7a2bb12a318	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	5a111de4-98a3-4d13-a47e-ae36180b9fbf	\N	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Bachata y Salsa Inicial - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:28.702+00
633d27d1-1c75-482a-a604-cb51330784cf	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	c6af6f71-e559-40f1-a2fe-66f62fa7a565	\N	{"name": "Histórica - Bachata y Salsa Inicial - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	{"name": "Histórica - Bachata y Salsa Inicial - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	\N	2026-09-28 22:19:28.732+00
d38dc52e-0c9a-41b9-ba66-e45a5cd57d8d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	441a9a62-ed1f-4ee1-a897-d52018f67a09	\N	{"name": "Histórica - Bachata y Salsa Inicial - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Bachata y Salsa Inicial - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:28.764+00
3390b192-892b-42d8-b66f-a2ee6d57e1c6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	9b0d1a7a-a562-4945-9999-dd4cbdccdfbc	\N	{"name": "Histórica - Belly Dance Alternativo - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-03-31", "validFrom": "2025-02-01"}	{"name": "Histórica - Belly Dance Alternativo - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-03-31", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:28.788+00
0b2f144a-248c-4581-828d-9a286adb6e77	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	5ff5584b-dd90-4a81-90b6-117e1f17a52a	\N	{"name": "Histórica - Clase femenino Sofi - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Clase femenino Sofi - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:28.825+00
ee930193-71ca-46f3-963e-8af6feb1660b	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	bb2fa800-9be7-4383-8484-562843342740	\N	{"name": "Histórica - Clase femenino Sofi - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-09-30", "validFrom": "2025-03-01"}	{"name": "Histórica - Clase femenino Sofi - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-09-30", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:28.858+00
73c0af1f-a627-4b12-b88d-d25fca0939e0	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	ae72f4d3-99d2-4ee2-bffd-07f7517e1dde	\N	{"name": "Histórica - Clase femenino Sofi - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-10-31", "validFrom": "2025-10-01"}	{"name": "Histórica - Clase femenino Sofi - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-10-31", "validFrom": "2025-10-01"}	\N	2026-09-28 22:19:28.879+00
71397f83-efe2-42e0-9f8e-9451a650dfda	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	c637f5c3-8007-4f2c-b43b-7522c9fba43b	\N	{"name": "Histórica - Clase femenino Sofi - 2025 - $25.000", "amount": "25000.00", "status": "ACTIVE", "validTo": "2026-02-28", "validFrom": "2025-11-01"}	{"name": "Histórica - Clase femenino Sofi - 2025 - $25.000", "amount": "25000.00", "status": "INACTIVE", "validTo": "2026-02-28", "validFrom": "2025-11-01"}	\N	2026-09-28 22:19:28.919+00
ef15d141-1123-4ab1-9e6a-77f8d6e82a99	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	18ca852e-066f-4f53-9463-9543bd7bff6c	\N	{"name": "Histórica - Clase femenino Sofi - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	{"name": "Histórica - Clase femenino Sofi - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	\N	2026-09-28 22:19:28.951+00
0a46350f-0105-4864-87ea-6d448a45848e	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	6f75e684-b414-4851-b628-d06b7a0d7492	\N	{"name": "Histórica - Clase femenino Sofi - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Clase femenino Sofi - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:29.003+00
db71db49-2aa6-442d-8c9f-52e30dab9866	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	0456fb7e-484b-4973-986f-8a072570650e	\N	{"name": "Histórica - Clase LT - A.Frank - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Clase LT - A.Frank - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:29.042+00
ddf99088-20e9-4f46-b1d9-59eeec5de672	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	72f79efb-bde5-47cb-a8b2-f17a3bf03cbd	\N	{"name": "Histórica - Clase LT - A.Frank - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Clase LT - A.Frank - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:29.073+00
53de92ba-1478-439e-b6e6-ed34d5dac5f3	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	676fde03-8873-4301-85ba-cc2a64126552	\N	{"name": "Histórica - Clase LT - A.Frank - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Clase LT - A.Frank - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:29.104+00
46ebbbc8-58ad-4a4e-8f8a-3ef556cce039	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	d3de6abe-8961-4ad9-b86b-b1fd6523013d	\N	{"name": "Histórica - Clase LT - A.Frank - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	{"name": "Histórica - Clase LT - A.Frank - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	\N	2026-09-28 22:19:29.135+00
498d97bb-ce80-4038-b078-5c6ff1f87a4f	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	ee08da83-5082-4bea-965c-add293d4095f	\N	{"name": "Histórica - Clase LT - A.Frank - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Clase LT - A.Frank - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:29.157+00
4b033862-eb71-4ee4-9cbb-778dde9a5cd6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	2fdefc77-2675-4091-b498-2595ba7a0ca2	\N	{"name": "Histórica - Coreográfico Bachata en Pareja - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-05-31", "validFrom": "2025-05-01"}	{"name": "Histórica - Coreográfico Bachata en Pareja - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-05-31", "validFrom": "2025-05-01"}	\N	2026-09-28 22:19:29.196+00
f57b6b33-d688-429b-af94-1a03f8eae7de	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	734edc8b-9709-46d2-a27f-653e4c6a70a0	\N	{"name": "Histórica - Coreográfico Bachata en Pareja - 2025 - $10.000", "amount": "10000.00", "status": "ACTIVE", "validTo": "2025-06-30", "validFrom": "2025-06-01"}	{"name": "Histórica - Coreográfico Bachata en Pareja - 2025 - $10.000", "amount": "10000.00", "status": "INACTIVE", "validTo": "2025-06-30", "validFrom": "2025-06-01"}	\N	2026-09-28 22:19:29.226+00
d4c8ec7c-436d-43d9-b0a2-c287d30e25ae	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	162ee729-b047-4333-a406-87ebf2a0f533	\N	{"name": "Histórica - Fitdance + Axé - 2025 - $7.500", "amount": "7500.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Fitdance + Axé - 2025 - $7.500", "amount": "7500.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:29.259+00
31f55249-5344-47e9-a1b9-5de195942b19	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a16c3950-049b-4fbf-b176-df8327d06f53	\N	{"name": "Histórica - Grupo C. - A.Frank - 2026 - $25.000", "amount": "25000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-03-01"}	{"name": "Histórica - Grupo C. - A.Frank - 2026 - $25.000", "amount": "25000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-03-01"}	\N	2026-09-28 22:19:29.288+00
054931bd-c05d-4659-b63f-72a367d779e1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	914435a3-afe2-4fe1-963b-11756a49460c	\N	{"name": "Histórica - Infantil (6 a 7 años) - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Infantil (6 a 7 años) - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:29.319+00
b09167bc-f6d0-435d-89db-c1d8c0f2e027	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	123779f5-04b8-4ffa-abee-99e3847f4b73	\N	{"name": "Histórica - Infantil (6 a 7 años) - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Infantil (6 a 7 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:29.351+00
d5d556e1-5be6-4396-97e5-06fb2895b321	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	d72e610b-f97f-4f4b-bdac-0b3a2863bd7f	\N	{"name": "Histórica - Infantil (6 a 7 años) - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Infantil (6 a 7 años) - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:29.38+00
991da074-c8eb-444b-a69a-77d0c3bf2e81	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	fc032672-6b48-4c9a-ba6a-6bd89d550ca5	\N	{"name": "Histórica - Infantil (6 a 7 años) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	{"name": "Histórica - Infantil (6 a 7 años) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	\N	2026-09-28 22:19:29.411+00
14259a44-0d7e-40c8-a20c-b7956d9cdc73	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	8da28256-cc8c-49fc-a870-aba43ee2c5e1	\N	{"name": "Histórica - Infantil (6 a 7 años) - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Infantil (6 a 7 años) - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:29.442+00
40eb479a-5341-4dfe-9af9-bb8230e80941	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	103cced5-8bf6-482d-adcf-07ffbbc59b24	\N	{"name": "Histórica - Kids 4-5 años - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-05-01"}	{"name": "Histórica - Kids 4-5 años - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-05-01"}	\N	2026-09-28 22:19:29.474+00
536b5239-de07-4ce2-b88b-04b21ed9a6c4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	925932a4-0520-4015-8371-c3a9be054e08	\N	{"name": "Histórica - Kids 4-5 años - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Kids 4-5 años - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:29.505+00
77ed5447-3e6f-43c6-8d14-19211f539002	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	3327e836-9638-472d-aba1-041a3a9f4e0d	\N	{"name": "Histórica - Kids 4-5 años - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	{"name": "Histórica - Kids 4-5 años - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-01-01"}	\N	2026-09-28 22:19:29.537+00
3f96d396-b5aa-4e3b-af0f-a97b35b380f8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	d486fbe3-9556-4719-9bdd-df68bd63118d	\N	{"name": "Histórica - Kids 4-5 años - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Kids 4-5 años - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:29.581+00
f64bedec-991c-4879-a8ae-9aa40f99a970	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	587baadd-638d-4787-8f10-e0f43c6d7881	\N	{"name": "Histórica - Ladys Kizz - 2025 - $7.500", "amount": "7500.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Ladys Kizz - 2025 - $7.500", "amount": "7500.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:29.606+00
a1b410bd-0594-4a8e-9128-60dea447ddca	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	9c8c66d8-4e97-4603-903a-ba1d2832c23c	\N	{"name": "Histórica - Ladys Kizz - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-07-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Ladys Kizz - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-07-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:29.646+00
69b0f65c-7743-4d85-9c92-5a1dd83ad61a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a69183c3-9be5-438e-9a58-1051ecfc6583	\N	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $7.500", "amount": "7500.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $7.500", "amount": "7500.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:29.689+00
14fbdd01-a5f0-4c2c-88b9-ebce462ec4aa	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	0fb22db6-e054-4fce-b307-d358d6dda3de	\N	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $10.000", "amount": "10000.00", "status": "ACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $10.000", "amount": "10000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:29.733+00
9daa4b36-bc37-4e6f-88f5-8cdcfe15cd39	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	bf30c76e-1c76-4865-a2f8-6dfca3c8c8eb	\N	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $11.000", "amount": "11000.00", "status": "ACTIVE", "validTo": "2025-06-30", "validFrom": "2025-05-01"}	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $11.000", "amount": "11000.00", "status": "INACTIVE", "validTo": "2025-06-30", "validFrom": "2025-05-01"}	\N	2026-09-28 22:19:29.766+00
9fa806e6-5460-461a-96a1-21582a7aece3	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	1cc0b2c3-cd83-432b-a4a5-d7008819c3c6	\N	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-07-31", "validFrom": "2025-07-01"}	{"name": "Histórica - Ladys Tango - Gabriela P. - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-07-31", "validFrom": "2025-07-01"}	\N	2026-09-28 22:19:29.797+00
bc3caea2-a89c-4cce-a51e-010ed19a1bf9	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	cba38891-1127-43ad-9dcc-7b8d2581d1c8	\N	{"name": "Histórica - Mambo en parejas - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	{"name": "Histórica - Mambo en parejas - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	\N	2026-09-28 22:19:29.83+00
203dd8d9-d813-4b10-8f37-bf27602925f1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	41fc1130-31df-4b19-94ae-8a83cc28cae7	\N	{"name": "Histórica - Mambo en parejas - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	{"name": "Histórica - Mambo en parejas - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	\N	2026-09-28 22:19:29.876+00
012a5f83-c564-4166-9513-1ef90ad32745	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a191574a-3c02-40e3-927e-41be6b018d55	\N	{"name": "Histórica - Mambo en parejas - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Mambo en parejas - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:29.922+00
eb2f84f3-59f1-4121-ba0e-bdc4c4dd1bf8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a5717945-007a-44b1-bdf4-686869052f4b	\N	{"name": "Histórica - Ritmos latinos y caribeños - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Ritmos latinos y caribeños - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:29.956+00
8f3f9556-713b-4252-b734-1396d1734405	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a65d4710-3bcb-4e8c-aef4-a051fad1608a	\N	{"name": "Histórica - Ritmos latinos y caribeños - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-07-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Ritmos latinos y caribeños - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-07-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:29.987+00
742a4bf8-627f-48bc-b98b-40646d814523	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	ed097626-3640-44b4-adc4-ac27eec79aee	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:30.032+00
dcce19fb-debe-4a4a-b60a-14494a3d7649	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	86ea823d-1082-45eb-b0d1-d722679d298d	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:30.062+00
17e46ed7-0e1a-47ba-a0fa-6ba0b83f720c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	22c0d8ba-2879-435c-8458-2ca064af6c80	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:30.094+00
fb734ab7-759a-49b5-959d-a492f0e6fb37	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	796a2823-cc0c-4b39-acd8-eb381b088209	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:30.125+00
cde0e64e-6dd5-40cb-afa7-d994053e4c34	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	ac03ca64-6890-458f-bb88-4e14644cf5d2	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:30.155+00
fd5b97ef-eb88-4af9-8636-a123b5f3f239	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	3779694f-c15e-4e36-b381-d91f46f32549	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:30.186+00
94b568e0-a816-4f13-9489-bf30c825c781	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	b2f1e2ca-0630-4bab-a01c-a6bf43949a6d	\N	{"name": "Histórica - Street Int/Avanzado - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Street Int/Avanzado - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:30.219+00
0f016e5b-03f6-4032-9011-164a1e36bd46	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	22574083-c342-4af1-b475-ff40a4193088	\N	{"name": "Histórica - Street Int/Avanzado - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - Street Int/Avanzado - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:30.24+00
a7c2b1f1-1ca4-4672-a55f-bd27c5bdc7a8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	3b329983-c407-46e5-8f5a-8e112688ca7a	\N	{"name": "Histórica - Tango (Inter/Avanz) - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Tango (Inter/Avanz) - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:30.279+00
c3eb578c-6075-4ba0-8183-94fcf876f639	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	bd91d623-5a66-45f6-9763-3bcc67dc6ab8	\N	{"name": "Histórica - Tango (Inter/Avanz) - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Tango (Inter/Avanz) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:30.311+00
b494427b-6f6e-407f-aac8-b67667642175	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	b30eecb7-73ea-46df-8979-9d599a6db2d7	\N	{"name": "Histórica - Tango (Inter/Avanz) - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Tango (Inter/Avanz) - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:30.342+00
670e3416-fa01-4220-8784-c3e360bd0b50	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	86843bf5-f1d7-4175-bb8d-f97019dc8a4c	\N	{"name": "Histórica - Tango (Inter/Avanz) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	{"name": "Histórica - Tango (Inter/Avanz) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	\N	2026-09-28 22:19:30.373+00
53c02cae-68ba-4662-92a0-50bf18310e83	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	52a9429d-f4ca-45cb-b754-2c1fc35ff6ed	\N	{"name": "Histórica - Tango (Inter/Avanz) - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Tango (Inter/Avanz) - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:30.406+00
17456779-05e4-4a24-a228-76d22ee022c8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	6994486c-c6c5-4256-b4d1-2c6af462fe0d	\N	{"name": "Histórica - Tango Inicial - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-03-31", "validFrom": "2026-03-01"}	{"name": "Histórica - Tango Inicial - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-03-31", "validFrom": "2026-03-01"}	\N	2026-09-28 22:19:30.451+00
8aaf67e3-5a36-48a2-bee5-5ae15139e0a2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	d30c4d7f-5861-468f-a593-61509fb932db	\N	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2025-02-28", "validFrom": "2025-02-01"}	\N	2026-09-28 22:19:30.483+00
7c48ef8c-9ad9-410e-8e17-72971d3eaf55	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	02f381ef-414d-4e75-9b9e-b657c693b7d9	\N	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $20.000", "amount": "20000.00", "status": "ACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-09-28 22:19:30.514+00
ef64d7d4-0026-4800-8f11-0c4dd9c25842	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	0cf97597-0cc8-4424-83f9-09112cbb0a39	\N	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-10-31", "validFrom": "2025-09-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-10-31", "validFrom": "2025-09-01"}	\N	2026-09-28 22:19:30.543+00
8b84ea3e-773c-47b9-8d8f-9f8f7b8a8f39	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	86ee3fcb-eb94-4d7d-a0d0-0e82c5b96081	\N	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $25.000", "amount": "25000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-11-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2025 - $25.000", "amount": "25000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-11-01"}	\N	2026-09-28 22:19:30.574+00
f954bc0e-0229-43f7-b97c-a19f9dc8f080	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	641bfe45-cdae-4050-a4d3-09cf6c5dcfd9	\N	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-01-31", "validFrom": "2026-01-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-01-31", "validFrom": "2026-01-01"}	\N	2026-09-28 22:19:30.606+00
c5112d41-5c0f-496d-a350-cb8af0ce242c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	bbe14afa-6e91-48c7-9108-768e253b5656	\N	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-02-28", "validFrom": "2026-02-01"}	\N	2026-09-28 22:19:30.637+00
f49c5e6b-d175-484e-90c1-ef9250fdc1c2	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	4a619e92-8a47-481c-ba44-3934c97c41d7	\N	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-03-01"}	\N	2026-09-28 22:19:30.667+00
26a2586d-6d7b-4e16-b050-20c0b4049cf6	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	24b8d991-5d15-429e-8621-45dc871f50fd	\N	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Teens (8 a 12 años) - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:30.699+00
91a42d69-3499-4622-83d2-f1fa5b9a4f25	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	89824a1f-9817-4e7e-9ccb-dec4cacaf971	\N	{"name": "Histórica - Zumba - Profe Joselo - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-05-01"}	{"name": "Histórica - Zumba - Profe Joselo - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-05-01"}	\N	2026-09-28 22:19:30.729+00
82c51332-c356-4f7c-a4b7-b14bec4e0afd	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	aa569d36-d055-4f83-98c2-04ae62aa9605	\N	{"name": "Histórica - Zumba - Profe Joselo - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Zumba - Profe Joselo - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-09-28 22:19:30.761+00
83132f7b-f64e-4e22-b024-209ce8e7f87b	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	9c8c66d8-4e97-4603-903a-ba1d2832c23c	\N	{"name": "Histórica - Ladys Kizz - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-07-31", "validFrom": "2025-03-01"}	{"name": "Histórica - Ladys Kizz - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-10-01 20:19:01.705+00
9e973686-71ff-4373-bcb2-94ef6871ecf9	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	86ea823d-1082-45eb-b0d1-d722679d298d	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-10-01 20:19:01.738+00
5004d665-9142-483a-a47b-006b85b9fe8a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	796a2823-cc0c-4b39-acd8-eb381b088209	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-10-01 20:19:01.754+00
2eee15da-d9a7-42cb-ae39-b9e0c46188f8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	3779694f-c15e-4e36-b381-d91f46f32549	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-10-01 20:19:01.785+00
d63f9e15-a92d-4852-9e66-52ebdfd2ba84	7d96c1bc-7329-413f-94c6-1c2f021eaed3	UPDATE	TARIFF	22574083-c342-4af1-b475-ff40a4193088	\N	{"name": "Histórica - Street Int/Avanzado - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-04-30", "validFrom": "2025-03-01"}	{"name": "Histórica - Street Int/Avanzado - 2025 - $20.000", "amount": "20000.00", "status": "INACTIVE", "validTo": "2025-08-31", "validFrom": "2025-03-01"}	\N	2026-10-01 20:19:01.803+00
9b6734f2-fcb3-4eee-aab0-a56c7fe7c5d3	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	f3d77d64-79df-40f5-bbe9-c7e1212bfa0e	\N	{"name": "Histórica - Ladys Kizz - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Ladys Kizz - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-10-01 20:19:01.845+00
71bf114f-2ee1-476c-b917-956615e00414	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	7bf87090-6f79-41eb-a46a-9ced068c5759	\N	{"name": "Histórica - Ladys Kizz - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	{"name": "Histórica - Ladys Kizz - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	\N	2026-10-01 20:19:01.884+00
f0778208-60bd-436e-8a1a-9288e1a4c766	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	14bf708d-20b2-4868-b09e-2103f21d9130	\N	{"name": "Histórica - Ladys Kizz - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	{"name": "Histórica - Ladys Kizz - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	\N	2026-10-01 20:19:01.922+00
5ba42f5e-d601-4efc-9844-25bb86c83d59	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	a7a80252-57de-41a6-9c22-e9c4da979600	\N	{"name": "Histórica - Ladys Kizz - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Ladys Kizz - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-10-01 20:19:01.954+00
3f9133b7-e54e-464a-977d-0612beeaa9a1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	f60f5345-4d4c-446c-a52d-ac9b24884bde	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-10-01 20:19:01.989+00
71f2ca8f-7a48-49ac-85b3-e0087504dcee	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	0d10e405-d5a7-4a0e-b739-6c1487222fb5	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	\N	2026-10-01 20:19:02.032+00
71359469-fdfd-43b1-b971-44543521dc5f	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	d147d7ff-7103-4e02-bfa0-3d680a515107	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	\N	2026-10-01 20:19:02.066+00
94436b51-b4b3-4e42-9d08-1e7db04c664a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	e2f40f29-6daa-4756-8edf-af82fbb35730	\N	{"name": "Histórica - S.C Adultos (+18 años) - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - S.C Adultos (+18 años) - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-10-01 20:19:02.112+00
d6ed7a12-e7a1-4557-802e-783cad422484	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	f2089824-1e87-48e8-a86d-fa7d9d8bb294	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-10-01 20:19:02.143+00
3a51d54a-6b5d-48b0-811d-32373894199d	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	54466e23-901a-474c-b308-1005e6c2e4a1	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	\N	2026-10-01 20:19:02.176+00
53494fc3-2ef4-421e-babb-720751bb7555	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	4821b330-fd0c-465b-aac1-e455c25eafef	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	\N	2026-10-01 20:19:02.219+00
78e3dd63-cff2-4f3c-b0bb-717040e35764	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	fc32f429-9816-4dd8-b6c6-52dfc093666f	\N	{"name": "Histórica - S.C Infantil (6-11 años) - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - S.C Infantil (6-11 años) - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-10-01 20:19:02.252+00
38271e60-57f8-4ef2-a8b4-a64ba15b55af	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	7fe71911-f958-40cf-bc93-af63df84e5af	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-10-01 20:19:02.3+00
68e26402-7b1b-491f-acca-3902af0d4dac	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	bc4b4bb2-b26e-498b-96a9-2439361bc017	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	\N	2026-10-01 20:19:02.344+00
c5cb6f2b-3bb0-4d7b-b8e1-4d43d14b2ee4	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	61ba6810-4779-4628-9a55-85bcbe50a85b	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	\N	2026-10-01 20:19:02.389+00
3ba23dbe-2b1c-4d0a-855f-fcf924566aa8	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	d3762c37-63b7-460f-be9f-d8df59f8593c	\N	{"name": "Histórica - S.C Juvenil (12-17 años) - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - S.C Juvenil (12-17 años) - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-10-01 20:19:02.42+00
c2b1d7c4-18ee-4807-b47a-ade6fac25756	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	9a5652e7-1099-4915-ba71-739135ec556c	\N	{"name": "Histórica - Street Int/Avanzado - 2025 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	{"name": "Histórica - Street Int/Avanzado - 2025 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2025-11-30", "validFrom": "2025-09-01"}	\N	2026-10-01 20:19:02.443+00
fc301442-50cb-4826-ac46-1cc54a5953ed	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	9444740f-d590-4310-a9e6-afff4f301224	\N	{"name": "Histórica - Street Int/Avanzado - 2026 - $30.000", "amount": "30000.00", "status": "ACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	{"name": "Histórica - Street Int/Avanzado - 2026 - $30.000", "amount": "30000.00", "status": "INACTIVE", "validTo": "2026-06-30", "validFrom": "2026-01-01"}	\N	2026-10-01 20:19:02.483+00
69c2f3ee-bafe-45ec-906a-873c5654fb49	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	2d651fdc-1dca-400f-8dab-efe75ef29ade	\N	{"name": "Histórica - Street Int/Avanzado - 2026 - $15.000", "amount": "15000.00", "status": "ACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	{"name": "Histórica - Street Int/Avanzado - 2026 - $15.000", "amount": "15000.00", "status": "INACTIVE", "validTo": "2026-07-31", "validFrom": "2026-07-01"}	\N	2026-10-01 20:19:02.513+00
3711edba-a882-41ed-b10b-f99f61bd7112	7d96c1bc-7329-413f-94c6-1c2f021eaed3	STATUS_CHANGE	TARIFF	5614c71c-e002-4142-b512-036adedb77ed	\N	{"name": "Histórica - Street Int/Avanzado - 2026 - $40.000", "amount": "40000.00", "status": "ACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	{"name": "Histórica - Street Int/Avanzado - 2026 - $40.000", "amount": "40000.00", "status": "INACTIVE", "validTo": "2026-08-31", "validFrom": "2026-08-01"}	\N	2026-10-01 20:19:02.546+00
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.branches (id, name, address, status, created_at, updated_at) FROM stdin;
12661d97-3998-4789-a9e5-44d72c5c7513	Carmesí	Pringles 321	ACTIVE	2026-08-21 23:38:46.418+00	2026-08-23 18:55:06.118+00
\.


--
-- Data for Name: cash_movements; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.cash_movements (id, cash_shift_id, type, method, amount, source_payment_id, source_payment_tender_id, reversal_of_id, actor_user_id, reason, created_at) FROM stdin;
\.


--
-- Data for Name: cash_reconciliation_corrections; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.cash_reconciliation_corrections (id, cash_shift_id, method, amount_delta, original_declared_amount, corrected_declared_amount, reason, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: cash_shift_closing_lines; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.cash_shift_closing_lines (id, cash_shift_id, method, expected_amount, declared_amount, difference_amount, created_at) FROM stdin;
\.


--
-- Data for Name: cash_shifts; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.cash_shifts (id, user_id, status, opened_at, closed_at, closed_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: class_schedules; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.class_schedules (id, class_id, day_of_week, start_time, end_time, room_id, status, created_at, updated_at) FROM stdin;
7aebe102-5397-4637-a694-e1fcc173439d	ff270dd4-aef0-4546-aeb7-24aa94093098	TUESDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-21 23:41:28.884+00	2026-08-23 19:58:01.427+00
48e5c9f8-cf05-48f6-81f2-598480e2a2cb	ff270dd4-aef0-4546-aeb7-24aa94093098	TUESDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 19:58:01.433+00	2026-08-23 19:58:01.433+00
fad2b21c-f688-4193-b273-bee9d2de26f6	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	MONDAY	15:00:00	16:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 21:55:41.274+00	2026-08-23 21:55:41.274+00
148b33fe-abca-4c20-9755-4de7ac855556	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	WEDNESDAY	15:00:00	16:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 21:55:41.274+00	2026-08-23 21:55:41.274+00
317e07ed-cc4e-497c-96c7-41a16d22e113	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	FRIDAY	15:00:00	16:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 21:55:41.274+00	2026-08-23 21:55:41.274+00
c3a63b33-47f9-4cf7-be31-c428508a064f	c90e7d2b-a10f-4a0c-9ee5-5dc1cdcb49c6	MONDAY	16:00:00	17:30:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 21:58:46.057+00	2026-08-23 21:58:46.057+00
85755430-528c-47ce-8a7a-787abf9a4077	c90e7d2b-a10f-4a0c-9ee5-5dc1cdcb49c6	WEDNESDAY	16:00:00	17:30:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 21:58:46.057+00	2026-08-23 21:58:46.057+00
efe2416a-cd0d-40ad-bec7-cfbc2b73f9cb	c90e7d2b-a10f-4a0c-9ee5-5dc1cdcb49c6	FRIDAY	16:00:00	17:30:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 21:58:46.057+00	2026-08-23 21:58:46.057+00
1b77bf9e-a054-4b4f-8992-56cb509b1365	df4e7b73-8b73-4753-a05a-19359dfbefa9	TUESDAY	16:00:00	18:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:06:32.419+00	2026-08-23 22:06:32.419+00
b2ba9920-b125-45b2-8fa8-06fa76cec868	df4e7b73-8b73-4753-a05a-19359dfbefa9	THURSDAY	16:00:00	18:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:06:32.419+00	2026-08-23 22:06:32.419+00
dc9aeb5c-34ee-4e10-af85-f3c00cfc4d00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	TUESDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:07:35.373+00	2026-08-23 22:07:35.373+00
a8dfd72c-8fd4-426f-8a05-cd9ce7e6c5ee	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	TUESDAY	19:00:00	20:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:08:00.662+00	2026-08-23 22:08:00.662+00
c1689cc2-1ffe-4f55-9e00-2d1ae60e777e	71bc486f-8a3d-46bb-a102-838cfef0a1fc	TUESDAY	20:00:00	21:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:08:38.652+00	2026-08-23 22:08:38.652+00
979730e8-53c6-4288-bd60-e1c25e107548	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	TUESDAY	21:00:00	22:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:10:04.309+00	2026-08-23 22:10:04.309+00
4c85af28-f5fc-4e45-b6b5-8883b700f9c6	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	MONDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-23 22:02:57.477+00	2026-08-23 22:11:14.673+00
153991e7-9652-49f1-85f0-61d31d626c40	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	MONDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-23 22:11:14.675+00	2026-08-23 22:13:07.881+00
d5dbc05c-cbd0-4746-bee9-307019dd4654	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	MONDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:13:07.884+00	2026-08-23 22:13:07.884+00
e1da206b-e8e7-40ae-866c-ff51f1ce6920	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	WEDNESDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:13:07.884+00	2026-08-23 22:13:07.884+00
6253c9eb-7381-462a-9709-a0e666986185	bcea570e-e3dd-499f-8a4b-88f079773871	MONDAY	19:00:00	20:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-23 22:03:30.73+00	2026-08-23 22:13:59.193+00
0bf925c5-4984-460e-93c5-76ec48c592a6	bcea570e-e3dd-499f-8a4b-88f079773871	MONDAY	19:00:00	20:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:13:59.194+00	2026-08-23 22:13:59.194+00
fdadba78-c0c5-46c1-8a54-43bd6966c0f0	bcea570e-e3dd-499f-8a4b-88f079773871	WEDNESDAY	19:00:00	20:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:13:59.194+00	2026-08-23 22:13:59.194+00
57bfdc9e-c0e7-4691-9b04-cdd651c5f937	da4d15d9-c846-4098-8640-e95fd97c604f	MONDAY	20:00:00	21:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-23 22:03:53.796+00	2026-08-23 22:14:45.554+00
840f9c13-30a6-44f1-8997-198975cb16d2	da4d15d9-c846-4098-8640-e95fd97c604f	MONDAY	20:00:00	21:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:14:45.555+00	2026-08-23 22:14:45.555+00
e6607af3-956a-4bcb-8d66-9c5243204220	da4d15d9-c846-4098-8640-e95fd97c604f	WEDNESDAY	20:00:00	21:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:14:45.555+00	2026-08-23 22:14:45.555+00
21d57dfd-7777-403e-82f0-0f8580f3f70b	d0762bb4-c6ef-45d4-8414-5ae0f158831f	MONDAY	21:00:00	22:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-23 22:05:37.114+00	2026-08-23 22:15:08.806+00
3a96291b-3927-488d-8471-ed41c73be068	d0762bb4-c6ef-45d4-8414-5ae0f158831f	MONDAY	21:00:00	22:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:15:08.809+00	2026-08-23 22:15:08.809+00
deed043d-3ed9-4eb3-b874-902c8eedb1ca	d0762bb4-c6ef-45d4-8414-5ae0f158831f	WEDNESDAY	21:00:00	22:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:15:08.809+00	2026-08-23 22:15:08.809+00
0bc86a80-a019-47f7-bb71-9e078442b27b	576c192b-8d45-47e9-bd94-df027445d793	TUESDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-23 22:10:36.989+00	2026-08-23 22:15:44.606+00
0ad85714-abb0-459b-a8d3-5fe960716d79	576c192b-8d45-47e9-bd94-df027445d793	TUESDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:15:44.607+00	2026-08-23 22:15:44.607+00
41383f4a-b917-4f71-a876-3b1d7fbf42c5	576c192b-8d45-47e9-bd94-df027445d793	THURSDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-23 22:15:44.607+00	2026-08-23 22:15:44.607+00
cc87c452-b18d-4b05-8287-38cf0f78549b	06f93e1a-5cc0-4741-8ad6-813745ea389d	FRIDAY	20:30:00	22:30:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-28 21:41:37.261+00	2026-08-28 21:41:37.261+00
0a01566c-90e5-4f1f-b739-3b4643dff25e	0dd78cf5-7a17-455c-9a70-1175a12d327d	SATURDAY	18:00:00	20:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-28 21:42:20.174+00	2026-08-28 21:42:20.174+00
555cefc7-a77b-40fc-a6d6-b7d8738039a5	ac972b45-74ce-49f8-be10-3a6f0151da82	SATURDAY	15:00:00	18:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-28 21:42:49.883+00	2026-08-28 21:42:49.883+00
6f06481e-4d8b-4c85-bbec-41555a4b6a81	b8e4d3e2-9fab-42d8-a036-8cfafdb8ec2b	MONDAY	14:00:00	17:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:44:16.963+00	2026-08-28 21:44:16.963+00
3992bcd9-b997-4e2f-983f-71472bb2cb92	b8e4d3e2-9fab-42d8-a036-8cfafdb8ec2b	WEDNESDAY	14:00:00	17:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:44:16.963+00	2026-08-28 21:44:16.963+00
cc0073a4-2711-4ce1-a433-80b532baced8	ab0fec00-54a8-414d-9714-ff2c3ce6e2ef	TUESDAY	15:00:00	17:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:45:35.607+00	2026-08-28 21:45:35.607+00
00814583-ca6c-40c1-8446-37aa75b3bd22	ab0fec00-54a8-414d-9714-ff2c3ce6e2ef	THURSDAY	15:00:00	17:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:45:35.607+00	2026-08-28 21:45:35.607+00
5c4050a4-0306-45fe-8fc9-b125a3a28433	acbbc26b-2a55-4952-97a0-92dc025024d2	TUESDAY	14:00:00	15:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:46:39.089+00	2026-08-28 21:46:39.089+00
dba93bca-9f9c-4fb3-84f9-10ce6de6ddbd	acbbc26b-2a55-4952-97a0-92dc025024d2	THURSDAY	14:00:00	15:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:46:39.089+00	2026-08-28 21:46:39.089+00
53929951-83d5-47f8-951d-df0373a84cc2	698c2fb9-7f35-4883-8124-3b0a3a673ce9	MONDAY	17:00:00	18:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:59:45.798+00	2026-08-28 21:59:45.798+00
0caeadf3-4140-406f-9c45-1775f8dbad08	698c2fb9-7f35-4883-8124-3b0a3a673ce9	WEDNESDAY	17:00:00	18:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 21:59:45.798+00	2026-08-28 21:59:45.798+00
b5cf4d19-ca7c-4e25-a7d6-bdbb119b89aa	1a8e1c0e-1f96-4de2-a33d-c932e74f2314	TUESDAY	17:00:00	18:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:00:47.513+00	2026-08-28 22:00:47.513+00
13566b12-57b5-4c7b-a15e-197fa85aaee0	1a8e1c0e-1f96-4de2-a33d-c932e74f2314	THURSDAY	17:00:00	18:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:00:47.513+00	2026-08-28 22:00:47.513+00
b0c91a19-f5e0-4cbd-a03b-0a228cad27cb	2b9ee038-bf48-4bb5-9315-c2015733d11c	MONDAY	19:00:00	20:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:02:09.946+00	2026-08-28 22:02:09.946+00
c2bcf98e-4fb0-4cfc-b6e5-1ce771b704a0	2b9ee038-bf48-4bb5-9315-c2015733d11c	WEDNESDAY	19:00:00	20:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:02:09.946+00	2026-08-28 22:02:09.946+00
b19ef8b7-dfe8-4037-b61a-cda972b4227c	0d42dcc6-8707-4a02-9bf1-f303077a6f44	FRIDAY	19:00:00	20:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:03:07.803+00	2026-08-28 22:03:07.803+00
1300a527-8648-406e-9459-fe13b5e937ba	0d42dcc6-8707-4a02-9bf1-f303077a6f44	SATURDAY	19:00:00	20:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:03:07.803+00	2026-08-28 22:03:07.803+00
579444a5-6c35-4ddb-a0a6-821a6d78ba16	4074b25f-622a-4423-ac82-9d0cf90e3666	MONDAY	20:00:00	21:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:04:17.326+00	2026-08-28 22:04:17.326+00
f73f9725-296e-4279-8f98-97b56e564351	4074b25f-622a-4423-ac82-9d0cf90e3666	WEDNESDAY	20:00:00	21:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:04:17.326+00	2026-08-28 22:04:17.326+00
77c60ac6-62d1-4704-81af-34b9ea057b10	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	MONDAY	21:00:00	22:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:04:53.185+00	2026-08-28 22:04:53.185+00
a332ca12-642c-4154-9c06-969109c310b8	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	WEDNESDAY	21:00:00	22:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:04:53.185+00	2026-08-28 22:04:53.185+00
a9422489-d649-4ced-980d-ff5bf6423ec1	cc392129-75e3-4205-b7fc-fafceb55b996	TUESDAY	21:00:00	22:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:05:27.578+00	2026-08-28 22:05:27.578+00
cff3174f-6ca4-47aa-ad4e-df940afdc620	cc392129-75e3-4205-b7fc-fafceb55b996	THURSDAY	21:00:00	22:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:05:27.578+00	2026-08-28 22:05:27.578+00
59d73d42-5a21-45c3-aaff-6ddb8ddab3be	dd4b0323-e82f-4b02-89c0-0f8e520033ed	FRIDAY	20:00:00	22:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:06:09.659+00	2026-08-28 22:06:09.659+00
daf5e1a3-bc21-4e7b-9fca-43e6d20958e4	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	SATURDAY	14:00:00	17:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	INACTIVE	2026-08-28 22:06:33.195+00	2026-08-28 22:06:35.514+00
eb03000d-86b8-4581-8c07-02694c8f4df5	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	SATURDAY	14:00:00	17:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-28 22:06:35.517+00	2026-08-28 22:06:35.517+00
9770477e-1d6c-4c71-8c61-35765537d3f1	2d17175b-22b0-4565-9342-1e93ad221855	MONDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-08-29 01:48:40.364+00	2026-08-29 01:48:42.956+00
41199dd1-e8cc-493a-a3b8-bf1f7ac46ff6	2d17175b-22b0-4565-9342-1e93ad221855	MONDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-08-29 01:48:42.959+00	2026-08-29 01:48:42.959+00
a1c7aecc-a9e6-403f-9137-58ae49ff2cc4	50f07573-4f58-4314-a0aa-e2e2d0feae71	WEDNESDAY	22:00:00	23:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-08-29 01:50:14.163+00	2026-08-29 01:50:14.163+00
e23165d4-2310-4bed-a4be-48946b48efb8	7b64e0e6-a347-4734-b2fa-b752fbe92cfb	SATURDAY	22:00:00	23:00:00	1b22371d-3ab7-4c8f-9579-96cf4e466f8c	ACTIVE	2026-09-02 22:27:27.05+00	2026-09-02 22:27:27.05+00
56802932-93b1-4c31-8800-b4dceccdf19b	a12f5acf-4754-479a-853c-15926c2dac92	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:16:48.53+00	2026-09-17 22:16:51.998+00
2d7ee946-f2e6-42b4-9fd3-5d0a59461d48	a12f5acf-4754-479a-853c-15926c2dac92	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:16:52.001+00	2026-09-17 22:16:52.001+00
3229b6c5-bacd-46dd-9f5c-864491c8d532	28f1b214-f935-4bea-8a8c-a28789592bb0	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:17:45.823+00	2026-09-17 22:17:47.884+00
d86d8e6e-36b4-47ba-9f67-5c26d74c2d05	28f1b214-f935-4bea-8a8c-a28789592bb0	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:17:47.886+00	2026-09-17 22:17:47.886+00
3e05bc51-f401-4a38-a9c0-e18f47dcaab4	23888530-c53d-4c40-94ee-982518e5d2f6	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:18:10.712+00	2026-09-17 22:18:12.964+00
ba8d4689-457f-4b5a-81cd-d0fadca60185	23888530-c53d-4c40-94ee-982518e5d2f6	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:18:12.966+00	2026-09-17 22:18:12.966+00
222f8549-775e-4f22-9b64-f2490ae8ceb3	db1e0e5e-c5e0-429e-aec3-4f28d406dad9	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:18:44.317+00	2026-09-17 22:18:46.348+00
b41af73a-042f-4083-b612-7a2b69f513f2	db1e0e5e-c5e0-429e-aec3-4f28d406dad9	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:18:46.349+00	2026-09-17 22:18:46.349+00
ddb3ecf0-9e5d-49eb-8e4c-cf44fb2b160c	8da07d2d-b252-4618-9370-34f8ca23e93e	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:19:08.4+00	2026-09-17 22:19:11.818+00
c5f50d7a-c21a-4cc5-ae7b-16456529bdad	8da07d2d-b252-4618-9370-34f8ca23e93e	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:19:11.82+00	2026-09-17 22:19:11.82+00
cb58afef-85e4-49ab-9cc5-398843ed6097	dbd5af21-ec55-4380-8ca1-d643a10d2003	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:21:04.009+00	2026-09-17 22:21:06.035+00
26b6c20d-cf0c-4b1c-bb49-87af66b93388	dbd5af21-ec55-4380-8ca1-d643a10d2003	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:21:06.036+00	2026-09-17 22:21:06.036+00
3c5333a2-7b02-42c1-8f07-babfcbb100f4	d06eb88b-a6e3-4cda-8bf9-5278455b3b7e	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-17 22:23:18.108+00	2026-09-17 22:23:19.733+00
d8a1180b-dab3-4319-9eda-74cbabec39fa	d06eb88b-a6e3-4cda-8bf9-5278455b3b7e	SUNDAY	18:00:00	19:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-17 22:23:19.735+00	2026-09-17 22:23:19.735+00
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.classes (id, name, dance_type_id, teacher_id, level, capacity, status, created_at, updated_at) FROM stdin;
ff270dd4-aef0-4546-aeb7-24aa94093098	arabashe	c0c5b062-b79f-4151-986a-f21af8f4779f	84f401a3-d810-40cb-b456-ac77c7c2dbcc	1	10	INACTIVE	2026-08-21 23:41:28.881+00	2026-08-23 19:58:01.424+00
5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	Zumba - Profe Joselo	c383ae58-ee02-40b7-9bfe-14d7d1489ad5	fcfd33ff-d0be-43bc-8440-1fb444c4eb33	1	20	ACTIVE	2026-08-23 21:55:41.268+00	2026-08-23 21:55:41.268+00
c90e7d2b-a10f-4a0c-9ee5-5dc1cdcb49c6	Ensayo Fabi	7aea6ddb-5c16-4f2a-8d37-92fca2217cb9	38514755-4686-4ca3-88c9-11d68985cdd6	1	20	ACTIVE	2026-08-23 21:58:46.054+00	2026-08-23 21:58:46.054+00
df4e7b73-8b73-4753-a05a-19359dfbefa9	Ensayo Santi	7aea6ddb-5c16-4f2a-8d37-92fca2217cb9	a289ca41-3d4d-402a-9e50-68801ed393c2	\N	10	ACTIVE	2026-08-23 22:06:32.417+00	2026-08-23 22:06:32.417+00
4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	S.C Infantil (6-11 años)	5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	a289ca41-3d4d-402a-9e50-68801ed393c2	1	30	ACTIVE	2026-08-23 22:07:35.37+00	2026-08-23 22:07:35.37+00
f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	S.C Juvenil (12-17 años)	5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	a289ca41-3d4d-402a-9e50-68801ed393c2	1	30	ACTIVE	2026-08-23 22:08:00.661+00	2026-08-23 22:08:00.661+00
71bc486f-8a3d-46bb-a102-838cfef0a1fc	S.C Adultos (+18 años)	5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	a289ca41-3d4d-402a-9e50-68801ed393c2	1	30	ACTIVE	2026-08-23 22:08:38.651+00	2026-08-23 22:08:38.651+00
b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	Clase kizomba	598b68b3-620b-4962-9d9c-2f6cf5820eb5	38514755-4686-4ca3-88c9-11d68985cdd6	1	20	ACTIVE	2026-08-23 22:10:04.307+00	2026-08-23 22:10:04.307+00
4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	Kids 4-5 años	7eb94d4f-3f01-45c5-9f19-dfa961b1287a	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	ACTIVE	2026-08-23 22:02:57.474+00	2026-08-23 22:13:07.879+00
bcea570e-e3dd-499f-8a4b-88f079773871	Infantil (6 a 7 años)	d770f144-4e1c-4285-be4a-2e38e86a2f68	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	ACTIVE	2026-08-23 22:03:30.704+00	2026-08-23 22:13:59.192+00
da4d15d9-c846-4098-8640-e95fd97c604f	Teens (8 a 12 años)	fd0bb761-00d0-4552-baa7-3af5f0d615c6	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	ACTIVE	2026-08-23 22:03:53.794+00	2026-08-23 22:14:45.552+00
d0762bb4-c6ef-45d4-8414-5ae0f158831f	Clase femenino Sofi	176dc0ef-6c95-44e4-b47a-74e61a80ca53	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	ACTIVE	2026-08-23 22:05:37.113+00	2026-08-23 22:15:08.803+00
576c192b-8d45-47e9-bd94-df027445d793	S&B Parejas	1971474d-58a8-4106-b241-6cd54033920d	38514755-4686-4ca3-88c9-11d68985cdd6	1	30	ACTIVE	2026-08-23 22:10:36.986+00	2026-08-23 22:15:44.604+00
06f93e1a-5cc0-4741-8ad6-813745ea389d	Ladys Kizz	ac496261-37da-4a02-ae89-b3895f321743	38514755-4686-4ca3-88c9-11d68985cdd6	1	20	ACTIVE	2026-08-28 21:41:37.258+00	2026-08-28 21:41:37.258+00
0dd78cf5-7a17-455c-9a70-1175a12d327d	Hells	f37fe3e0-547d-4484-bb53-b77f570b4742	a289ca41-3d4d-402a-9e50-68801ed393c2	1	20	ACTIVE	2026-08-28 21:42:20.172+00	2026-08-28 21:42:20.172+00
ac972b45-74ce-49f8-be10-3a6f0151da82	Grupo C. Sofi	7aea6ddb-5c16-4f2a-8d37-92fca2217cb9	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	20	ACTIVE	2026-08-28 21:42:49.882+00	2026-08-28 21:42:49.882+00
b8e4d3e2-9fab-42d8-a036-8cfafdb8ec2b	Ensayo Ana	e368265e-6cc7-4a5f-b8f3-31fe4fdbb4db	e6fe9713-5f07-4a67-8613-4ddb0e936efa	2	15	ACTIVE	2026-08-28 21:44:16.961+00	2026-08-28 21:44:16.961+00
ab0fec00-54a8-414d-9714-ff2c3ce6e2ef	Ensayo Sofi	ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	5e3dfae4-8670-4dfa-a351-d889551ab3e7	2	10	ACTIVE	2026-08-28 21:45:35.605+00	2026-08-28 21:45:35.605+00
acbbc26b-2a55-4952-97a0-92dc025024d2	Bachata y Salsa Inicial	1971474d-58a8-4106-b241-6cd54033920d	fcfd33ff-d0be-43bc-8440-1fb444c4eb33	1	30	ACTIVE	2026-08-28 21:46:39.087+00	2026-08-28 21:46:39.087+00
698c2fb9-7f35-4883-8124-3b0a3a673ce9	Iniciación a la danza (babys)	7eb94d4f-3f01-45c5-9f19-dfa961b1287a	9ace89e8-ca8d-4069-b972-6af360ee834f	1	30	ACTIVE	2026-08-28 21:59:45.795+00	2026-08-28 21:59:45.795+00
1a8e1c0e-1f96-4de2-a33d-c932e74f2314	Ritmos latinos y caribeños	237eb103-5fe0-4ee0-9982-0cd1ea5eb58c	9ace89e8-ca8d-4069-b972-6af360ee834f	1	30	ACTIVE	2026-08-28 22:00:47.511+00	2026-08-28 22:00:47.511+00
2b9ee038-bf48-4bb5-9315-c2015733d11c	Árabe infantil	b555edf5-8eb5-4744-a9b9-c2e0f9ccce78	297cc413-faec-4274-8de1-272f32231fa5	1	15	ACTIVE	2026-08-28 22:02:09.945+00	2026-08-28 22:02:09.945+00
0d42dcc6-8707-4a02-9bf1-f303077a6f44	Árabe Juv/Adultos	ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	5e3dfae4-8670-4dfa-a351-d889551ab3e7	2	30	ACTIVE	2026-08-28 22:03:07.802+00	2026-08-28 22:03:07.802+00
4074b25f-622a-4423-ac82-9d0cf90e3666	Clase LT - A.Frank	ac496261-37da-4a02-ae89-b3895f321743	e6fe9713-5f07-4a67-8613-4ddb0e936efa	1	30	ACTIVE	2026-08-28 22:04:17.324+00	2026-08-28 22:04:17.324+00
b96017bd-9ee1-4bde-ad35-ad961a78e5f5	Mambo en parejas	4c2ae2c0-616f-48b4-b72c-4299dc80ae5f	d38d5749-cf17-49ab-a9f9-af4078408cdc	2	30	ACTIVE	2026-08-28 22:04:53.183+00	2026-08-28 22:04:53.183+00
cc392129-75e3-4205-b7fc-fafceb55b996	Tango (Inter/Avanz)	19e25d27-319e-4311-ab1f-389444d1e332	79685a44-f200-473c-9185-4c45b97e7441	3	30	ACTIVE	2026-08-28 22:05:27.576+00	2026-08-28 22:05:27.576+00
dd4b0323-e82f-4b02-89c0-0f8e520033ed	Street Int/Avanzado	5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	a289ca41-3d4d-402a-9e50-68801ed393c2	2	30	ACTIVE	2026-08-28 22:06:09.658+00	2026-08-28 22:06:09.658+00
e63b18a1-afc2-4fd1-aa80-dfce8909e30f	Grupo C. - A.Frank	7aea6ddb-5c16-4f2a-8d37-92fca2217cb9	e6fe9713-5f07-4a67-8613-4ddb0e936efa	1	20	INACTIVE	2026-08-28 22:06:33.193+00	2026-08-28 22:06:35.511+00
2d17175b-22b0-4565-9342-1e93ad221855	Coreografico E.Masc-Bachata/Urban	ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	INACTIVE	2026-08-29 01:48:40.359+00	2026-08-29 01:48:42.952+00
50f07573-4f58-4314-a0aa-e2e2d0feae71	Formacion Docente En Ritmos Caribeños Y Kizomba	2b42ccc6-54a4-4ea6-b348-206e291c1b37	38514755-4686-4ca3-88c9-11d68985cdd6	1	30	ACTIVE	2026-08-29 01:50:14.16+00	2026-08-29 01:50:14.16+00
7b64e0e6-a347-4734-b2fa-b752fbe92cfb	Inst.Sup.Coreografico -Tango /18 Meses	19e25d27-319e-4311-ab1f-389444d1e332	79685a44-f200-473c-9185-4c45b97e7441	3	30	ACTIVE	2026-09-02 22:27:27.046+00	2026-09-02 22:27:27.046+00
a12f5acf-4754-479a-853c-15926c2dac92	Ladys Tango - Gabriela P.	19e25d27-319e-4311-ab1f-389444d1e332	38bfbac8-b451-4e00-ae80-9317a6628c17	1	30	INACTIVE	2026-09-17 22:16:48.527+00	2026-09-17 22:16:51.988+00
28f1b214-f935-4bea-8a8c-a28789592bb0	Coreográfico Bachata en Pareja	ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	a289ca41-3d4d-402a-9e50-68801ed393c2	1	30	INACTIVE	2026-09-17 22:17:45.822+00	2026-09-17 22:17:47.883+00
23888530-c53d-4c40-94ee-982518e5d2f6	Tango Inicial	19e25d27-319e-4311-ab1f-389444d1e332	38bfbac8-b451-4e00-ae80-9317a6628c17	1	30	INACTIVE	2026-09-17 22:18:10.709+00	2026-09-17 22:18:12.962+00
db1e0e5e-c5e0-429e-aec3-4f28d406dad9	Fitdance + Axé	5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	fcfd33ff-d0be-43bc-8440-1fb444c4eb33	1	30	INACTIVE	2026-09-17 22:18:44.315+00	2026-09-17 22:18:46.346+00
8da07d2d-b252-4618-9370-34f8ca23e93e	Bachata Pasos Sueltos	ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	INACTIVE	2026-09-17 22:19:08.399+00	2026-09-17 22:19:11.817+00
dbd5af21-ec55-4380-8ca1-d643a10d2003	Belly Dance Alternativo	5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	297cc413-faec-4274-8de1-272f32231fa5	1	30	INACTIVE	2026-09-17 22:21:04.007+00	2026-09-17 22:21:06.032+00
d06eb88b-a6e3-4cda-8bf9-5278455b3b7e	Bachata en Pareja	ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	d38d5749-cf17-49ab-a9f9-af4078408cdc	1	30	INACTIVE	2026-09-17 22:23:18.106+00	2026-09-17 22:23:19.732+00
\.


--
-- Data for Name: dance_types; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.dance_types (id, name, normalized_name, description, status, created_at, updated_at) FROM stdin;
e368265e-6cc7-4a5f-b8f3-31fe4fdbb4db	Salsa	salsa	\N	ACTIVE	2026-08-23 19:08:12.797+00	2026-08-23 19:08:12.797+00
598b68b3-620b-4962-9d9c-2f6cf5820eb5	Kizomba	kizomba	\N	ACTIVE	2026-08-23 19:05:57.904+00	2026-08-23 19:08:16.831+00
ffb7ba8f-2091-4eea-a83c-4e0e61f85d71	Bachata	bachata	\N	ACTIVE	2026-08-23 19:08:22.521+00	2026-08-23 19:08:22.521+00
19e25d27-319e-4311-ab1f-389444d1e332	Tango	tango	\N	ACTIVE	2026-08-23 19:08:25.072+00	2026-08-23 19:08:25.072+00
f37fe3e0-547d-4484-bb53-b77f570b4742	Heels	heels	\N	ACTIVE	2026-08-23 19:08:31.445+00	2026-08-23 19:08:31.445+00
c383ae58-ee02-40b7-9bfe-14d7d1489ad5	Zumba	zumba	\N	ACTIVE	2026-08-23 19:08:35.468+00	2026-08-23 19:08:35.468+00
b555edf5-8eb5-4744-a9b9-c2e0f9ccce78	Danza Árabe	danza árabe	\N	ACTIVE	2026-08-23 19:08:42.202+00	2026-08-23 19:08:42.202+00
4c2ae2c0-616f-48b4-b72c-4299dc80ae5f	Mambo	mambo	\N	ACTIVE	2026-08-23 19:08:47.356+00	2026-08-23 19:08:47.356+00
f37426dc-b841-4ca8-8b18-27d140e93b2e	Urbano	urbano	\N	ACTIVE	2026-08-23 19:08:50.086+00	2026-08-23 19:08:50.086+00
5c97ad5c-1038-4b53-8a4b-cb7b5acce3f3	Street Coreográfico	street coreográfico	\N	ACTIVE	2026-08-23 19:14:26.141+00	2026-08-23 19:14:26.141+00
1971474d-58a8-4106-b241-6cd54033920d	Salsa/Bachata	salsa/bachata	\N	ACTIVE	2026-08-23 19:20:55.624+00	2026-08-23 19:20:55.624+00
237eb103-5fe0-4ee0-9982-0cd1ea5eb58c	Ritmos Caribeños	ritmos caribeños	\N	ACTIVE	2026-08-23 19:21:10.429+00	2026-08-23 19:21:10.429+00
2b42ccc6-54a4-4ea6-b348-206e291c1b37	Ritmos Caribeños/Kizomba	ritmos caribeños/kizomba	\N	ACTIVE	2026-08-23 19:21:18.864+00	2026-08-23 19:21:18.864+00
7aea6ddb-5c16-4f2a-8d37-92fca2217cb9	Coreográfico	coreográfico	\N	ACTIVE	2026-08-23 19:21:32.07+00	2026-08-23 19:21:32.07+00
176dc0ef-6c95-44e4-b47a-74e61a80ca53	Estilo Femenino	estilo femenino	\N	ACTIVE	2026-08-23 19:56:44.732+00	2026-08-23 19:56:44.732+00
ac496261-37da-4a02-ae89-b3895f321743	Lady's Training	lady's training	\N	ACTIVE	2026-08-23 19:56:51.172+00	2026-08-23 19:56:51.172+00
7eb94d4f-3f01-45c5-9f19-dfa961b1287a	Kids	kids	\N	ACTIVE	2026-08-23 22:01:36.036+00	2026-08-23 22:01:36.036+00
d770f144-4e1c-4285-be4a-2e38e86a2f68	Infantil	infantil	\N	ACTIVE	2026-08-23 22:01:41.208+00	2026-08-23 22:01:41.208+00
fd0bb761-00d0-4552-baa7-3af5f0d615c6	Teens	teens	\N	ACTIVE	2026-08-23 22:01:44.805+00	2026-08-23 22:01:44.805+00
c0c5b062-b79f-4151-986a-f21af8f4779f	danza prueba	danza prueba	\N	INACTIVE	2026-08-21 23:38:12.83+00	2026-08-28 23:31:44.197+00
\.


--
-- Data for Name: enrollment_billing_conditions; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.enrollment_billing_conditions (id, enrollment_id, type, calculation, configured_value, effective_from, effective_until, teacher_id, authorized_by_user_id, created_by_user_id, ended_by_user_id, ended_at, reason, end_reason, renewed_from_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.enrollments (id, student_id, class_id, start_date, end_date, status, created_at, updated_at) FROM stdin;
c914adaf-c8ad-4bef-91e6-8228b41698b1	8bed59f3-936a-4fdd-bf39-475c686481b7	ff270dd4-aef0-4546-aeb7-24aa94093098	2026-08-21	2026-08-23	ENDED	2026-08-22 01:02:10.427+00	2026-08-23 19:57:49.914+00
a1cd8d8b-f092-4b40-9644-509c3e71b55a	ddc77860-17e6-4310-a399-7ea7365f3ccb	ff270dd4-aef0-4546-aeb7-24aa94093098	2026-08-21	2026-08-23	ENDED	2026-08-21 23:41:39.025+00	2026-08-23 19:57:55.517+00
54073623-1d9f-4438-bc30-7dbf92194560	42e15f9c-7320-4458-9d43-d755b9fb8a03	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.778+00	2026-08-29 02:23:08.778+00
d1c77770-1c9b-47e9-8832-654f619542d9	79224b93-2a40-4d0e-85ee-caec0d3c3a01	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.807+00	2026-08-29 02:23:08.807+00
983c29bc-63e7-4eae-ae63-ce072edfc8a9	79224b93-2a40-4d0e-85ee-caec0d3c3a01	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.839+00	2026-08-29 02:23:08.839+00
b1fbc378-9af1-4df1-9cb4-887eb553c2f0	4d6a3455-1ce6-44d8-846e-382899d35c73	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.9+00	2026-08-29 02:23:08.9+00
3d9651e4-ce92-4adf-8468-5d74f0e907fb	9cb09f48-0770-4af1-b9cf-54fae1fd15ef	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.935+00	2026-08-29 02:23:08.935+00
8078cb96-13cb-45f8-83d2-b62630baba37	ceec123a-5d45-44fa-a3d5-f325ebd18cd0	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.963+00	2026-08-29 02:23:08.963+00
e268b3ae-a38e-4d8c-a891-abbb3d478310	d9a7a5b9-cad3-45a6-9499-44d0e4fe8ce8	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.026+00	2026-08-29 02:23:09.026+00
b9acb006-2931-4f28-bbaa-026397a80fcf	a7c74644-d186-44fb-917b-3882623523b9	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.057+00	2026-08-29 02:23:09.057+00
8268394f-2ab3-48da-b9d6-6ad804dbd54d	e3d42e74-cf95-499a-9ad2-35d0abf7e500	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.12+00	2026-08-29 02:23:09.12+00
c06bf612-fbfe-465f-9f7d-33e6573953fd	e535d5fc-d1f4-4e83-a5eb-47bca35ad4d2	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.165+00	2026-08-29 02:23:09.165+00
dbe50306-4c42-425d-9bf7-717191ca87c1	220a254e-381b-4236-9c90-c8fa2bae00c3	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.274+00	2026-08-29 02:23:09.274+00
05bdf441-111e-4151-94df-2f92fbd69627	a38e7370-fee4-4345-93ac-cf6ae5006b9a	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.304+00	2026-08-29 02:23:09.304+00
c187cfbe-8308-47b7-8b64-a9efa6947c07	6290ccdb-2615-4ba3-a563-e55e6f5333b9	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.409+00	2026-08-29 02:23:10.409+00
72d15c2a-eebf-4405-bfc3-5d51f5ffba35	df2e9a16-b155-43e6-9ffd-e70c5026481b	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.595+00	2026-08-29 02:23:10.595+00
72efbb6a-3a57-4773-a5b7-ebf984b82751	9254f230-7913-4feb-be5c-1264137f3b9a	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.879+00	2026-08-29 02:23:10.879+00
16bd52dc-0827-4123-9fe4-80f38594c798	bfd88cee-ae21-47f2-b6dd-72d57b145b31	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-06-01	\N	ACTIVE	2026-08-29 02:23:08.744+00	2026-09-02 22:25:34.703+00
334630a6-7ed1-4163-baf6-8e2ff76b26f0	08c5343e-fc53-41ed-bd41-05429bd7995b	bcea570e-e3dd-499f-8a4b-88f079773871	2025-04-01	\N	ACTIVE	2026-08-29 02:23:09.583+00	2026-09-02 22:25:34.754+00
e4d06c2e-d22a-4b63-b6d4-a82a24eb6f11	824df025-def1-46c0-af0e-0477fd7a1719	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-02-01	\N	ACTIVE	2026-08-29 02:23:09.522+00	2026-09-02 22:25:34.856+00
821ed7e9-4663-4924-8b4c-112efa6e4601	b8bae188-1b10-4118-8cd3-e97cfd4aeec5	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-02-01	\N	ACTIVE	2026-08-29 02:23:10.848+00	2026-09-02 22:25:34.919+00
cd6301f0-6bfa-49e0-b66c-83c2013f3602	4e6cb7ef-a16e-46a8-9e0c-9f72abd6c513	2b9ee038-bf48-4bb5-9315-c2015733d11c	2025-10-01	\N	ACTIVE	2026-08-29 02:23:10.351+00	2026-09-02 22:25:34.982+00
ed47d74a-5fc4-4fe7-a4c3-b615b67eef6b	15dccc6f-7cc5-475b-9704-768d3f3b7bcb	576c192b-8d45-47e9-bd94-df027445d793	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.336+00	2026-09-02 22:25:35.012+00
54ea49b5-199e-4a95-bdf3-ceb1143ea367	15dccc6f-7cc5-475b-9704-768d3f3b7bcb	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.368+00	2026-09-02 22:25:35.044+00
1c2ab5eb-df2c-4f3d-8c3b-f76dd4a19127	15dccc6f-7cc5-475b-9704-768d3f3b7bcb	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.4+00	2026-09-02 22:25:35.061+00
48606f18-b95d-491b-aebb-853fe3cf9ea2	aa6f3582-c3be-4632-a28b-6a52572af725	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-03-01	\N	ACTIVE	2026-08-29 02:23:10.315+00	2026-09-02 22:25:35.138+00
9494f045-39f5-4152-b08d-6c81a1ff00df	df2e9a16-b155-43e6-9ffd-e70c5026481b	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-01-01	\N	ACTIVE	2026-08-29 02:23:10.63+00	2026-09-02 22:25:35.286+00
9ff83e27-5c73-4691-b95c-1ac1b7607d32	9967814e-bd85-4322-8516-09b903de0237	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-06-01	\N	ACTIVE	2026-08-29 02:23:09.711+00	2026-09-02 22:25:35.606+00
aa9aad11-b141-4fab-b698-abafe3332d66	9967814e-bd85-4322-8516-09b903de0237	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-06-01	\N	ACTIVE	2026-08-29 02:23:09.741+00	2026-09-02 22:25:35.659+00
dfb1c37c-4de2-4394-9e2e-7dc9c76c5110	997c0e8e-9152-449a-8ffb-9b68a7536349	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-02-01	\N	ACTIVE	2026-08-29 02:23:08.593+00	2026-09-02 22:25:35.691+00
dd461a48-adde-435b-abe1-367fa1e7aca1	997c0e8e-9152-449a-8ffb-9b68a7536349	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-02-01	\N	ACTIVE	2026-08-29 02:23:08.561+00	2026-09-02 22:25:35.713+00
bc836422-a9d6-44b8-92af-13497e61914f	997c0e8e-9152-449a-8ffb-9b68a7536349	576c192b-8d45-47e9-bd94-df027445d793	2025-02-01	\N	ACTIVE	2026-08-29 02:23:08.622+00	2026-09-02 22:25:35.74+00
27e17064-1159-43eb-9715-5a0ba0daf55f	997c0e8e-9152-449a-8ffb-9b68a7536349	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-02-01	\N	ACTIVE	2026-08-29 02:23:08.527+00	2026-09-02 22:25:35.766+00
a7ffc953-4a7a-4b70-82ba-0f2debb7c98b	2eaa7af6-8603-44a1-a71a-2407b668372a	cc392129-75e3-4205-b7fc-fafceb55b996	2026-04-01	\N	ACTIVE	2026-08-29 02:23:08.713+00	2026-09-02 22:25:35.928+00
c507451a-a69e-41c0-bc9d-bd625a76c4b0	f5ca223e-79ec-4546-a181-36a488589191	da4d15d9-c846-4098-8640-e95fd97c604f	2025-03-01	\N	ACTIVE	2026-08-29 02:23:10.566+00	2026-09-02 22:25:36.007+00
aca14f90-9e94-40ad-973a-02cd7bb728fa	0138b18b-e037-47a5-ae52-fbe92f0ac7ff	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-02-01	\N	ACTIVE	2026-08-29 02:23:10.379+00	2026-09-02 22:25:36.038+00
d7fb4d41-d97d-404c-999e-07f3ed712ed9	d609ebd0-85ea-45c8-aae0-c8ad16036947	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-02-01	\N	ACTIVE	2026-08-29 02:23:09.646+00	2026-09-02 22:25:36.058+00
a0234d55-9968-4ea4-829f-e6a36c1c5dab	2d2d8459-38c0-4d13-8c4e-217789edcce0	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-03-01	\N	ACTIVE	2026-08-29 02:23:08.994+00	2026-09-02 22:25:36.086+00
667b69d3-a853-4a35-8290-b2612ff756c4	a6104629-708b-46d0-9b13-5d074bcbed25	cc392129-75e3-4205-b7fc-fafceb55b996	2025-10-01	\N	ACTIVE	2026-08-29 02:23:08.649+00	2026-09-02 22:25:36.236+00
62336ef3-f403-4649-b60e-eaa90e2f7994	5661b9ff-03e3-4951-b426-09dc613a59f5	4074b25f-622a-4423-ac82-9d0cf90e3666	2025-05-01	\N	ACTIVE	2026-08-29 02:23:10.66+00	2026-09-02 22:25:36.358+00
90dc9b84-3ee1-4eef-95e2-2c772f601d2d	c047fbfa-5531-4b7f-ac51-d00609133285	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-03-01	\N	ACTIVE	2026-08-29 02:23:09.088+00	2026-09-02 22:25:36.424+00
4b3f4cba-1b9c-47b0-8033-e86dc6de0eea	25c63902-bc14-4221-a549-441c09cf4768	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-02-01	\N	ACTIVE	2026-08-29 02:23:09.772+00	2026-09-02 22:25:36.48+00
4cedc994-5cab-4dd1-84bb-4bbd4069777f	ae113266-bea6-4ec2-b7ab-9841fbe7bde5	bcea570e-e3dd-499f-8a4b-88f079773871	2025-05-01	\N	ACTIVE	2026-08-29 02:23:09.43+00	2026-09-02 22:25:36.569+00
6ddc6e3f-7b76-4924-aefa-dc5f58693a76	5a8926bc-871e-4beb-a27e-91c00f38f67c	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-01	\N	ACTIVE	2026-08-29 02:23:10.253+00	2026-09-02 22:25:36.6+00
d2f857cb-50e5-4dbd-80f1-b7c40ef18cb2	fe2876e4-6433-4d44-a5e3-89a8a0d67433	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2025-05-01	\N	ACTIVE	2026-08-29 02:23:10.534+00	2026-09-02 22:25:36.728+00
62f7c8f8-6cd5-4547-ab18-f18ee4b8f504	89b51d7f-4a99-4805-8f75-13b32420f8f0	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-06-01	\N	ACTIVE	2026-08-29 02:23:10.69+00	2026-09-02 22:25:37.049+00
07e76d09-099f-47b8-a47b-0f2a9085abda	454a2da4-1337-4d63-bc8c-676b36c2098f	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-03-01	\N	ACTIVE	2026-08-29 02:23:08.457+00	2026-09-02 22:25:37.133+00
703341c8-6013-4d00-9a39-074c0bb71d3d	c9d07213-f8ad-40f2-b459-2be739cc05b7	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-03-01	\N	ACTIVE	2026-08-29 02:23:10.008+00	2026-09-02 22:25:37.193+00
a8ab5ac2-9879-4bcd-a5bb-d63726ea796a	c9d07213-f8ad-40f2-b459-2be739cc05b7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-03-01	\N	ACTIVE	2026-08-29 02:23:10.035+00	2026-09-02 22:25:37.208+00
450dab8e-cc4b-4cb6-89e0-2f0ba8e226aa	e3d42e74-cf95-499a-9ad2-35d0abf7e500	576c192b-8d45-47e9-bd94-df027445d793	2025-11-01	\N	ACTIVE	2026-08-29 02:23:09.142+00	2026-09-02 22:25:37.236+00
c84ad4ef-fd58-4b52-a059-00afff51b226	6523d623-9d87-4ab5-a632-765da7d2e604	4074b25f-622a-4423-ac82-9d0cf90e3666	2025-03-01	\N	ACTIVE	2026-08-29 02:23:09.243+00	2026-09-02 22:25:37.446+00
824d7160-dd8c-41e2-8b10-f61222407028	e2f3404c-63d7-4c3b-b434-45549922ea59	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-05-01	\N	ACTIVE	2026-08-29 02:23:10.502+00	2026-09-02 22:25:37.539+00
ca390232-a9e8-40b3-af1e-0400387bcbb7	40950d87-dc66-405f-9295-7b0625b592aa	bcea570e-e3dd-499f-8a4b-88f079773871	2025-08-01	\N	ACTIVE	2026-08-29 02:23:10.723+00	2026-09-02 22:25:37.609+00
14b43222-dc42-4861-bfbe-9a85f60718cb	97e34e29-16e6-4644-aa44-0f7c88dba8aa	576c192b-8d45-47e9-bd94-df027445d793	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.13+00	2026-09-02 22:25:37.763+00
fe6b20b5-a837-4220-96ce-7dfb2cb24674	97e34e29-16e6-4644-aa44-0f7c88dba8aa	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.163+00	2026-09-02 22:25:37.796+00
677e814f-65da-4baa-bfd0-d67c2d94dc17	97e34e29-16e6-4644-aa44-0f7c88dba8aa	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.196+00	2026-09-02 22:25:37.837+00
8391b952-cff0-4051-af5d-727bf7a9305f	97e34e29-16e6-4644-aa44-0f7c88dba8aa	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.224+00	2026-09-02 22:25:37.868+00
879cd81d-7f71-4e72-a3da-4571a6821ee4	d9d2c6a8-42e8-45d8-a549-6f553ae8a4c2	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-09-01	\N	ACTIVE	2026-08-29 02:23:09.461+00	2026-09-02 22:25:38.028+00
216dc74c-968b-41bf-9cd6-92654246809b	d9d2c6a8-42e8-45d8-a549-6f553ae8a4c2	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-09-01	\N	ACTIVE	2026-08-29 02:23:09.491+00	2026-09-02 22:25:38.059+00
c85563ae-f620-43f8-a1d3-af281ddd7330	7f5c0637-0f59-4fbd-b65f-cf09cbb25687	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.442+00	2026-09-02 22:25:38.166+00
d79f04c2-ca72-4afc-b6e3-e0b9a1f27f0d	7f5c0637-0f59-4fbd-b65f-cf09cbb25687	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.472+00	2026-09-02 22:25:38.182+00
f0358837-25f3-4550-ab32-2bf034ee2c80	7a0da8cb-aeef-49cb-a4be-3773436f945a	cc392129-75e3-4205-b7fc-fafceb55b996	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.185+00	2026-09-02 22:25:38.818+00
c1349c0c-3093-4dbe-a157-35e7751ed221	45cd7c0b-1f2f-435a-947a-f1301d2f99a3	cc392129-75e3-4205-b7fc-fafceb55b996	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.804+00	2026-09-02 22:25:38.989+00
e197b78c-75a8-4959-a142-40aad231c434	ce69fede-102f-4ba9-9ee8-5a9889f98676	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-03-01	\N	ACTIVE	2026-08-29 02:23:10.284+00	2026-09-02 22:25:39.02+00
86269235-6937-4ea3-b186-6f15cc3c307c	fc1308bd-fc2d-474e-ab5e-688a861d6ab6	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-01-01	\N	ACTIVE	2026-08-29 02:23:08.683+00	2026-09-02 22:25:39.073+00
dc019bd9-7bb9-4688-b23d-082ac2088e97	8456df92-458f-4081-9a21-e926ef940a0e	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-10-01	\N	ACTIVE	2026-08-29 02:23:10.066+00	2026-09-02 22:25:39.099+00
e212c100-cbcc-4a05-a571-3e64a08f1b1f	8456df92-458f-4081-9a21-e926ef940a0e	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-10-01	\N	ACTIVE	2026-08-29 02:23:10.099+00	2026-09-02 22:25:39.13+00
cc86acd4-4ea1-4f2d-83fb-ffeed34f35b1	a3a92c1a-d667-4962-b1a1-3c1ac3c5f365	2b9ee038-bf48-4bb5-9315-c2015733d11c	2025-01-01	\N	ACTIVE	2026-08-29 02:23:09.553+00	2026-09-02 22:25:39.18+00
262b19f7-109b-400e-a06f-3f1cf24a4b9e	f2aae84b-e156-4d9d-81f3-d50a56e02255	576c192b-8d45-47e9-bd94-df027445d793	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.779+00	2026-09-02 22:25:39.237+00
446d48bc-b72a-434c-a9ff-b2d930dba75f	f2aae84b-e156-4d9d-81f3-d50a56e02255	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.755+00	2026-09-02 22:25:39.268+00
8cb1c60c-f7fb-4553-98c6-c31cabaac525	27152b91-3376-464f-b17b-b011d278918f	4074b25f-622a-4423-ac82-9d0cf90e3666	2025-01-01	\N	ACTIVE	2026-08-29 02:23:09.865+00	2026-09-02 22:25:39.375+00
66bdc1fe-31ad-4156-add0-1ec8e780d325	27152b91-3376-464f-b17b-b011d278918f	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-01-01	\N	ACTIVE	2026-08-29 02:23:09.835+00	2026-09-02 22:25:39.406+00
7daa6195-adfa-4cd3-a21b-98e216551732	1eb674f1-d0c8-4e43-9414-f322dac17aa3	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-08-01	\N	ACTIVE	2026-08-29 02:23:08.498+00	2026-09-02 22:25:39.598+00
f1127eb6-4f70-4c4a-aa15-4ff037faabbc	d5c24860-da44-4c74-b22a-97bdf8f42c22	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-02-01	\N	ACTIVE	2026-08-29 02:23:10.817+00	2026-09-02 22:25:39.63+00
4924a721-6a90-418c-9e18-9b22bce8fef3	074b51e1-fa83-411b-a297-0971b3e4f074	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-01-01	\N	ACTIVE	2026-08-29 02:23:09.896+00	2026-09-02 22:25:39.973+00
69ead856-f1f4-4ee4-ab2a-1de459df358a	074b51e1-fa83-411b-a297-0971b3e4f074	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-01-01	\N	ACTIVE	2026-08-29 02:23:09.929+00	2026-09-02 22:25:40.005+00
e980a2d2-a8b3-42d0-a19e-cc7910a58a0d	408771b7-b499-4521-bb0d-ac790af66da1	cc392129-75e3-4205-b7fc-fafceb55b996	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.616+00	2026-09-02 22:25:40.067+00
8207e702-e5e1-4b43-8f75-060d4cad4382	dd5e52c4-3ac5-468c-b81e-32744f518de8	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.068+00	2026-08-29 02:23:11.068+00
2d4fb39b-11c2-4a5d-9307-9879b594d770	56bd8b07-68d5-4c19-b828-2bfeb4fbfb3e	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.131+00	2026-08-29 02:23:11.131+00
1e36db58-169b-4923-bf55-0e3bd5226cf6	a337c9c9-e4e9-4fdb-a634-b7a84d3ede86	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.163+00	2026-08-29 02:23:11.163+00
fb6e41ec-8d17-4099-a2e1-9ad9646bdd6d	2896238a-f2a3-4c9b-8ea2-22083e8f59a9	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.224+00	2026-08-29 02:23:11.224+00
6ca889ba-7c4e-4a04-be82-051b975c34e8	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.287+00	2026-08-29 02:23:11.287+00
df4e87a0-6dfc-4f10-a501-b701e899b1ff	598cc625-80fc-4755-acd8-a4d0f57e7641	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.876+00	2026-08-29 02:23:11.876+00
8ffdc7fa-ef04-4607-b5bc-98bbbc5b4451	8ecb69c8-daf6-4b1b-869b-348c8cd2d4a1	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.283+00	2026-08-29 02:23:12.283+00
84d5dce8-cc10-439c-b293-30c09836281f	132b2658-c520-4be0-9f93-93827720fdf1	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.315+00	2026-08-29 02:23:12.315+00
e0bec1ce-d547-4e81-a46f-79f0977ffd6a	bfa38797-b517-4143-b7d1-0c893df2af11	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.47+00	2026-08-29 02:23:12.47+00
108d25fa-9107-4131-bbfb-5bc1e85d0222	161530a6-02b6-40ea-a32d-1d7df44b787b	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.624+00	2026-08-29 02:23:12.624+00
d06ba8db-971b-4611-a866-faf086707c2f	b68131ac-a62d-411a-b2ed-5ebe901a5ab8	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.686+00	2026-08-29 02:23:12.686+00
f06ff8b1-5984-4900-b7a0-ee9c6c87524b	88dcb0b7-845e-4f80-9584-ab11d60786d0	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.717+00	2026-08-29 02:23:12.717+00
ef18b707-0f2b-4a67-a2ac-319f417f6b29	85a80831-c1f1-4c7e-8198-ee05d349a8f4	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.749+00	2026-08-29 02:23:12.749+00
b59c5cbd-ab51-4f86-8b7b-a5313225bd74	e6d631b5-ec70-460b-9835-66eabfb66176	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.061+00	2026-08-29 02:23:13.061+00
c12d932c-ed66-41bf-b0e3-7951c7f5aa53	2167fac4-4feb-42cb-815d-a3f9a7b2e2c8	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.271+00	2026-08-29 02:23:13.271+00
87dbe8b1-3837-47f1-9fef-da9a8be9f9ab	6617b5c0-3cc9-4197-b7ed-d9bd279a674f	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.438+00	2026-08-29 02:23:13.438+00
b709dfc8-6ba3-45ab-93b2-06fb2d057193	6617b5c0-3cc9-4197-b7ed-d9bd279a674f	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-06-01	\N	ACTIVE	2026-08-29 02:23:13.405+00	2026-09-02 22:25:34.79+00
b251e2c9-b8ff-4c6e-be60-314ebb86945d	e131203a-d7c6-40a0-bcd4-062e41335e8f	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-01-01	\N	ACTIVE	2026-08-29 02:23:11.941+00	2026-09-02 22:25:34.824+00
272f4993-c935-4f72-9192-70f5497afa2b	757fbdf4-80af-4d43-ae09-fb75ece1a012	2b9ee038-bf48-4bb5-9315-c2015733d11c	2025-05-01	\N	ACTIVE	2026-08-29 02:23:11.41+00	2026-09-02 22:25:34.95+00
d8556163-6a96-47cc-93f7-8587bf14e441	9890b644-50c6-47a6-9ff4-ced2356cfa6b	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-04-01	\N	ACTIVE	2026-08-29 02:23:13.202+00	2026-09-02 22:25:35.165+00
cc8729c0-5918-4543-83b7-4f3efc32a84b	9890b644-50c6-47a6-9ff4-ced2356cfa6b	576c192b-8d45-47e9-bd94-df027445d793	2025-04-01	\N	ACTIVE	2026-08-29 02:23:13.236+00	2026-09-02 22:25:35.206+00
b540cab0-4dc5-42b7-8eea-c458bee72aec	9890b644-50c6-47a6-9ff4-ced2356cfa6b	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-04-01	\N	ACTIVE	2026-08-29 02:23:13.17+00	2026-09-02 22:25:35.232+00
efe1c7c5-34ea-4e9d-8ac2-c39b239233c7	bbfad32d-4feb-40a4-8fea-90c12297c9d7	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.845+00	2026-09-02 22:25:35.259+00
6789125c-821e-4618-b76e-7f6f50e74af7	f237f4bc-8093-431f-8598-ff503ef70187	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.784+00	2026-09-02 22:25:35.553+00
58ffe3b5-90e6-4b00-8cfd-4f0c471119cf	f237f4bc-8093-431f-8598-ff503ef70187	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.753+00	2026-09-02 22:25:35.579+00
677485ff-90ae-4541-aa32-05894f2d9916	c6108d50-a4d4-4193-8305-c3e06b7eaf17	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2026-05-01	\N	ACTIVE	2026-08-29 02:23:12.5+00	2026-09-02 22:25:35.827+00
add0649b-99b5-4832-a920-df0c09ee03b5	1071b1bd-3026-4810-b527-6d33437e99cd	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.91+00	2026-09-02 22:25:35.886+00
cb879a9f-a9ba-4c87-872d-e71a520e4518	c976f4cf-e794-4697-a578-76e46a4d7c57	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-01	\N	ACTIVE	2026-08-29 02:23:12.872+00	2026-09-02 22:25:35.958+00
ea8f292c-0152-453e-8a0c-9dfb78be4da7	668965b1-0738-4249-b880-ac0dff06a17b	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2025-10-01	\N	ACTIVE	2026-08-29 02:23:11.815+00	2026-09-02 22:25:35.978+00
1e5270bb-cf5d-45fd-b160-fe766c48a2d4	f20f54d6-ebcc-4829-b110-67f0c1c7aae1	bcea570e-e3dd-499f-8a4b-88f079773871	2025-02-01	\N	ACTIVE	2026-08-29 02:23:12.129+00	2026-09-02 22:25:36.113+00
8d4d413e-2f89-4533-97be-6ead75ef9489	955a0573-f1c3-4810-84bd-f657fd6b734c	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.568+00	2026-09-02 22:25:36.182+00
34bd6178-6c00-4210-a5f0-00b16dcb0d77	955a0573-f1c3-4810-84bd-f657fd6b734c	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.6+00	2026-09-02 22:25:36.206+00
c9a452ce-e16a-4d47-a067-e5c2f6e40360	ddf38b55-0d22-466e-b13c-c67a1631f7f3	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-09-01	\N	ACTIVE	2026-08-29 02:23:12.25+00	2026-09-02 22:25:36.448+00
fd172c23-5b49-450c-be20-1a9308e0a53f	f78f638a-546b-4e50-afc4-d54f655bf96a	cc392129-75e3-4205-b7fc-fafceb55b996	2025-03-01	\N	ACTIVE	2026-08-29 02:23:12.19+00	2026-09-02 22:25:36.706+00
f5106f21-fc88-4a1d-b7f7-f144eaf686d5	daada42a-8ccb-40ad-b8c8-66f65dcf2a39	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-01-01	\N	ACTIVE	2026-08-29 02:23:12.903+00	2026-09-02 22:25:36.765+00
f1ab3374-8eb7-475b-88dd-0bce75ddb025	daada42a-8ccb-40ad-b8c8-66f65dcf2a39	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-01-01	\N	ACTIVE	2026-08-29 02:23:12.936+00	2026-09-02 22:25:36.802+00
ba663c8b-78b1-40f6-ab11-c91e8b82ddd0	f0bf368a-4c7b-40a1-9ce3-c7f4719efec9	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-01	\N	ACTIVE	2026-08-29 02:23:12.034+00	2026-09-02 22:25:36.834+00
97924a23-2721-45df-89ea-629dccf4073a	18c12bef-a4e7-4fc1-854a-91c8347c48f9	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ACTIVE	2026-08-29 02:23:12.222+00	2026-09-02 22:25:36.866+00
9ed439ed-809c-45c1-8dde-ad4977936276	ff5d8b46-3458-40cd-a9a8-9b47fc500d33	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-03-01	\N	ACTIVE	2026-08-29 02:23:12.158+00	2026-09-02 22:25:36.907+00
3fac09ba-5286-450e-a187-b9445a39a109	064dfa74-0e77-44eb-901f-93e457ef4a65	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2025-09-01	\N	ACTIVE	2026-08-29 02:23:11.538+00	2026-09-02 22:25:37.163+00
dd9857b9-8502-4bb5-a1b6-22ed7694180b	528f5372-4d0f-4864-92b0-93d8bd6d1a93	4074b25f-622a-4423-ac82-9d0cf90e3666	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.442+00	2026-09-02 22:25:37.267+00
e58e1908-a9ac-4b7f-b7dc-9da5595de45a	528f5372-4d0f-4864-92b0-93d8bd6d1a93	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.474+00	2026-09-02 22:25:37.285+00
59c589da-3a44-41f0-813f-8c87c215d133	60ffaac9-4651-41d0-8f32-23d99aa67420	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-02-01	\N	ACTIVE	2026-08-29 02:23:12.779+00	2026-09-02 22:25:37.314+00
e3d1b240-ba9d-4b00-9991-9f72e58ed76a	60ffaac9-4651-41d0-8f32-23d99aa67420	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2025-02-01	\N	ACTIVE	2026-08-29 02:23:12.81+00	2026-09-02 22:25:37.343+00
a31491f2-90cc-448b-bc80-2ff825ef5e12	60ffaac9-4651-41d0-8f32-23d99aa67420	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-02-01	\N	ACTIVE	2026-08-29 02:23:12.842+00	2026-09-02 22:25:37.374+00
2c9f5f00-40f6-4cee-a33a-e30d05c08792	e6d631b5-ec70-460b-9835-66eabfb66176	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ACTIVE	2026-08-29 02:23:13.031+00	2026-09-02 22:25:37.398+00
2a10630c-984d-4eed-b63c-1e32adb3d6cf	e6d631b5-ec70-460b-9835-66eabfb66176	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-01-01	\N	ACTIVE	2026-08-29 02:23:12.997+00	2026-09-02 22:25:37.421+00
a903a415-fd3f-473d-bca8-94d8df8f28de	d60d7504-4213-45c0-9757-7646d010dd1a	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-08-01	\N	ACTIVE	2026-08-29 02:23:11.006+00	2026-09-02 22:25:37.477+00
21e68f45-8f24-4ca2-8811-81d39230d5af	d1667b8b-ac3a-4f37-8e6b-4b75dc5f1418	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-05-01	\N	ACTIVE	2026-08-29 02:23:13.14+00	2026-09-02 22:25:37.644+00
6067ecc8-7f73-4706-994b-dfe7b6043900	8d18ee38-ca45-4ee5-af25-2df796d371eb	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.504+00	2026-09-02 22:25:37.908+00
4a7f0fed-2e85-40a3-b6eb-0eadea007e59	c9987164-f80e-4908-af0b-ccd57b667bd7	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-05-01	\N	ACTIVE	2026-08-29 02:23:13.348+00	2026-09-02 22:25:37.974+00
ad855591-50b0-4e87-8eb6-66dd7d559f1f	d5bd7500-6267-473f-aa6a-1d5f129fe33c	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2025-08-01	\N	ACTIVE	2026-08-29 02:23:11.099+00	2026-09-02 22:25:38.268+00
42cf5454-9699-4b03-800c-35fe51589f73	440f71df-52eb-4c53-9b3a-a7ee701c29ba	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-06-01	\N	ACTIVE	2026-08-29 02:23:11.036+00	2026-09-02 22:25:38.406+00
7ef87448-5616-4244-99eb-e502c671d911	6a556835-d1d2-4a99-8888-3e47ae0cc87c	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-05-01	\N	ACTIVE	2026-08-29 02:23:13.311+00	2026-09-02 22:25:38.516+00
14885617-4c4a-485b-a812-f421e3aeec7d	218e3a17-234c-4b08-81df-613ece4a4606	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-01	\N	ACTIVE	2026-08-29 02:23:13.107+00	2026-09-02 22:25:38.579+00
6a8c4084-48b1-4da8-890d-6f2c811aee42	808556f1-82dc-46fb-b058-5f13582c4b8f	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2026-08-01	\N	ACTIVE	2026-08-29 02:23:12.004+00	2026-09-02 22:25:38.741+00
5f312c32-1003-4ba2-9f07-8eba908f7575	808556f1-82dc-46fb-b058-5f13582c4b8f	576c192b-8d45-47e9-bd94-df027445d793	2026-08-01	\N	ACTIVE	2026-08-29 02:23:11.971+00	2026-09-02 22:25:38.758+00
2c98df00-09f4-4ae5-aca8-7ccbce71e645	21220e88-5f94-4c2b-9a9d-b3c0b21c3c44	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-01	\N	ACTIVE	2026-08-29 02:23:13.081+00	2026-09-02 22:25:38.85+00
ca875684-25f3-46cf-9245-6f3afa3c9ab2	29244aa1-ed07-4256-903a-b69d13078eab	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-09-01	\N	ACTIVE	2026-08-29 02:23:12.966+00	2026-09-02 22:25:38.88+00
6faccecb-2be5-4d78-9e10-700be0047f9c	0f66f0ff-d9e6-4195-94bb-060aeafe2502	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-01	\N	ACTIVE	2026-08-29 02:23:12.594+00	2026-09-02 22:25:38.899+00
bcf0f2e9-4a11-457c-8eb7-e82fd4b7b776	fc282a39-09ec-494f-a177-ccba97d90797	576c192b-8d45-47e9-bd94-df027445d793	2025-09-01	\N	ACTIVE	2026-08-29 02:23:12.406+00	2026-09-02 22:25:38.926+00
9be516fc-051a-420e-92d4-1e004b4df42a	fc282a39-09ec-494f-a177-ccba97d90797	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-09-01	\N	ACTIVE	2026-08-29 02:23:12.437+00	2026-09-02 22:25:38.956+00
c4cbe39d-8828-4f5e-bc59-3e3a3c172917	287e8a09-5b0b-40e6-8c30-3fb6c065dbff	da4d15d9-c846-4098-8640-e95fd97c604f	2025-03-01	\N	ACTIVE	2026-08-29 02:23:11.691+00	2026-09-02 22:25:39.208+00
2a6ad745-05a9-4b74-bb00-5d66b221752f	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-01-01	\N	ACTIVE	2026-08-29 02:23:11.35+00	2026-09-02 22:25:39.286+00
c91bf3aa-0c80-43c2-9526-99f3a45d3cb7	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-01-01	\N	ACTIVE	2026-08-29 02:23:11.318+00	2026-09-02 22:25:39.314+00
5a1b5302-ecb3-406d-9f68-06a1b67f119d	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-01-01	\N	ACTIVE	2026-08-29 02:23:11.381+00	2026-09-02 22:25:39.343+00
9150e89a-f4fb-44f4-b080-621d1116c9ac	5bb9359d-768a-4cce-a92c-16a95641759f	bcea570e-e3dd-499f-8a4b-88f079773871	2025-03-01	\N	ACTIVE	2026-08-29 02:23:11.722+00	2026-09-02 22:25:39.433+00
c59c8931-a690-4f76-8b43-ca1c3041294a	26ec3b0a-5193-465e-9d38-45cfb38ae0b3	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-01-01	\N	ACTIVE	2026-08-29 02:23:11.256+00	2026-09-02 22:25:39.466+00
0336cf0a-2b57-4e86-93c2-a39e5f6682ed	8a27a773-fda2-4bd2-ac79-caaf4bf972fe	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-03-01	\N	ACTIVE	2026-08-29 02:23:12.065+00	2026-09-02 22:25:39.542+00
a69a236f-ad70-4ef7-9a36-1782a6f6424d	674c8e8e-1a1d-4c62-9785-16d526fd3c95	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-02-01	\N	ACTIVE	2026-08-29 02:23:10.974+00	2026-09-02 22:25:39.661+00
741acf2d-dfe9-4dd1-8d94-940749ca56e0	790eae5e-6087-40a6-b640-651843ec4646	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-10-01	\N	ACTIVE	2026-08-29 02:23:12.657+00	2026-09-02 22:25:39.691+00
846e044a-aedc-4490-9d6d-ee4002e3f0b4	aa4f35db-ca8b-4829-ab74-60c57521f462	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-03-01	\N	ACTIVE	2026-08-29 02:23:11.66+00	2026-09-02 22:25:39.709+00
fd9ee0ed-dcac-460e-830f-9b2cff826d98	0304d8cf-6f00-41a8-a675-b98592bafb97	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-01	\N	ACTIVE	2026-08-29 02:23:12.344+00	2026-09-02 22:25:39.742+00
364ab26d-bde3-4a73-95d0-2d9bada46a25	0304d8cf-6f00-41a8-a675-b98592bafb97	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-01	\N	ACTIVE	2026-08-29 02:23:12.376+00	2026-09-02 22:25:39.774+00
908c3761-e400-4060-a732-1527991f2fd7	16c93792-8688-4a6d-89d3-ca97e4ad944f	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-01-01	\N	ACTIVE	2026-08-29 02:23:10.91+00	2026-09-02 22:25:39.835+00
8fd95b2b-862b-416e-a0f5-f19adce933f8	9a24244d-0c3b-461b-95c7-57d682862292	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-09-01	\N	ACTIVE	2026-08-29 02:23:11.631+00	2026-09-02 22:25:39.868+00
1d5ecf7e-b20f-4626-99d8-766cca96a82f	b0bb2d93-1d20-4cf3-8867-2250bd830889	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-04-01	\N	ACTIVE	2026-08-29 02:23:12.097+00	2026-09-02 22:25:39.911+00
9c797deb-6d4c-4d88-b430-89fd1843df7f	64a99306-c339-401e-8461-d2c2f93b0c61	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-05-01	\N	ACTIVE	2026-08-29 02:23:10.942+00	2026-09-02 22:25:39.942+00
6e5f858a-dac9-4ed4-abda-096737627dfd	b081171b-df46-4671-8679-cdb140896300	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.65+00	2026-08-29 02:23:13.65+00
a1a2e5de-6907-4c89-bf5b-a959bd15c863	7ad17a5c-8489-4f01-858b-b171b6282e03	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.869+00	2026-08-29 02:23:13.869+00
fb812eb2-323b-49e4-a4db-1f9b89335888	5a2db33a-7b69-4246-9b6f-b882dfd79764	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.992+00	2026-08-29 02:23:13.992+00
5fe3c8b0-9f11-4116-9c4e-864857dd264a	32a952d0-5c16-456e-be91-e928d6ca4eef	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.291+00	2026-08-29 02:23:14.291+00
11f4fdd7-c12e-4d23-9556-d912040b3d54	32a952d0-5c16-456e-be91-e928d6ca4eef	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.323+00	2026-08-29 02:23:14.323+00
d5ff245b-9346-439a-8f4f-da707c25fb15	21c54b2e-1542-4f84-a96d-1758f848b973	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.359+00	2026-08-29 02:23:14.359+00
0335f2da-8f7f-495c-a510-14505b54ed56	e89fd784-8b1d-4be3-b410-2482f9b94d86	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.405+00	2026-08-29 02:23:14.405+00
e9d73d91-e79b-4291-a427-a7056a3373c2	8f82478a-a7b6-4960-853c-cf371cead592	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.078+00	2026-08-29 02:23:15.078+00
8fd64891-a2cc-4e08-94e4-01c0a7ce3b08	8aed5d20-bbe6-4316-b78b-0e6cd9de1ace	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.11+00	2026-08-29 02:23:15.11+00
b1bfcb37-5405-4822-94fe-9f84bfc44bab	b48cbe49-b182-45ec-a845-5a64ef0ab8b7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.496+00	2026-08-29 02:23:15.496+00
11c8cc73-13be-439a-a8ff-f95a57684f45	bc06e985-bd2a-4319-bf66-8880c6e4e46d	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.527+00	2026-08-29 02:23:15.527+00
dc710853-0a16-4238-a849-6ac0cc8cbeb7	a8eb74e2-1946-460f-be24-c9f4466e9d7c	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2025-04-01	\N	ACTIVE	2026-08-29 02:23:13.804+00	2026-09-02 22:25:34.56+00
6c43601f-6b6f-4f4e-b0db-5e45292dc39e	fcfce898-5c18-4924-93cf-1b7036f11ba5	4074b25f-622a-4423-ac82-9d0cf90e3666	2025-02-01	\N	ACTIVE	2026-08-29 02:23:11.193+00	2026-09-02 22:25:34.584+00
938d7e10-3c2a-403a-8074-aea33227512b	7384e63e-d9e2-4c9c-818b-d98579f2dba8	cc392129-75e3-4205-b7fc-fafceb55b996	2026-03-01	\N	ACTIVE	2026-08-29 02:23:14.585+00	2026-09-02 22:25:34.607+00
f6538920-7951-4797-97b5-a708a526fb1a	e85c8d41-7f2f-44ac-a122-5fac5e2f7463	cc392129-75e3-4205-b7fc-fafceb55b996	2026-03-01	\N	ACTIVE	2026-08-29 02:23:09.211+00	2026-09-02 22:25:34.638+00
5565ac81-f785-42c8-8f91-21aa0992bbad	f1998bf5-63a4-4990-b367-82d4124a9cdf	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-01	\N	ACTIVE	2026-08-29 02:23:14.152+00	2026-09-02 22:25:34.669+00
97f59f09-2841-4691-929e-ff86cf773d4b	a6360973-3706-48fd-8f1c-8cba57b53f8d	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-02-01	\N	ACTIVE	2026-08-29 02:23:13.468+00	2026-09-02 22:25:34.725+00
9924272a-de32-4d2b-b4be-31022f0f3f54	793d1985-0bcc-4d43-93be-fd4df9cf2e39	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-01-01	\N	ACTIVE	2026-08-29 02:23:14.864+00	2026-09-02 22:25:34.886+00
ca8b0125-30c6-4c92-8ed8-1cdb3d919ca6	df69102b-aa50-44da-8cac-a0e502072582	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-01	\N	ACTIVE	2026-08-29 02:23:14.649+00	2026-09-02 22:25:35.086+00
618dec37-fa62-4126-8f71-1800825d93f8	022f2847-381c-4541-891f-0f38253235f5	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-03-01	\N	ACTIVE	2026-08-29 02:23:13.838+00	2026-09-02 22:25:35.113+00
04a8bd30-efff-4095-b38d-3fcdaacd90df	a4030ecd-e658-4a4d-a015-e7d9302e6d58	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-02-01	\N	ACTIVE	2026-08-29 02:23:14.056+00	2026-09-02 22:25:35.303+00
a55f1d83-95b0-4ed1-82c1-915f89f741ae	a4030ecd-e658-4a4d-a015-e7d9302e6d58	576c192b-8d45-47e9-bd94-df027445d793	2025-02-01	\N	ACTIVE	2026-08-29 02:23:14.092+00	2026-09-02 22:25:35.325+00
c23136b0-96f1-4f27-ae3d-c642b5a09010	c3e2f29d-7147-4ffd-967b-ec3c9472b6ac	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-01-01	\N	ACTIVE	2026-08-29 02:23:15.372+00	2026-09-02 22:25:35.367+00
5f6d3dd5-1e91-40a4-91ce-b5d5cc52f42d	a5f67efa-a60d-465c-996d-acc357010e3b	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-02-01	\N	ACTIVE	2026-08-29 02:23:15.404+00	2026-09-02 22:25:35.395+00
49539e1a-7e3f-47e7-a398-4b49fa3b707d	a5f67efa-a60d-465c-996d-acc357010e3b	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-02-01	\N	ACTIVE	2026-08-29 02:23:15.434+00	2026-09-02 22:25:35.419+00
130ff8fb-70c3-4760-9960-b27893a990f1	a5f67efa-a60d-465c-996d-acc357010e3b	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-02-01	\N	ACTIVE	2026-08-29 02:23:15.464+00	2026-09-02 22:25:35.446+00
27e77571-f588-468b-871f-0904be7131b1	7155ff13-ed1e-40fc-af42-d30383691132	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-01-01	\N	ACTIVE	2026-08-29 02:23:15.049+00	2026-09-02 22:25:35.472+00
d88067e7-c807-43c9-9ac1-6b7d13b25a62	1e53518b-8e46-4670-a5c6-72c101b35134	576c192b-8d45-47e9-bd94-df027445d793	2026-08-01	\N	ACTIVE	2026-08-29 02:23:13.901+00	2026-09-02 22:25:35.499+00
0d8c35e5-3a79-45b5-87e4-d91ccfbaddde	c4cbc2b3-137b-4a1d-918a-69d45e26f725	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2025-01-01	\N	ACTIVE	2026-08-29 02:23:15.313+00	2026-09-02 22:25:35.526+00
e197eaf2-6df7-49e1-9050-2432306bc6fd	9967814e-bd85-4322-8516-09b903de0237	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-06-01	\N	ACTIVE	2026-08-29 02:23:09.676+00	2026-09-02 22:25:35.632+00
0e52d82d-93ef-48f3-9736-3eb4076d9493	e0d23592-89d1-42df-a4b5-a726468411be	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-01-01	\N	ACTIVE	2026-08-29 02:23:13.621+00	2026-09-02 22:25:35.796+00
02ddd619-230c-4032-9b37-15360f07bfbc	88f8e49f-6866-4aa4-8a6c-20a69ce1b7f4	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-06-01	\N	ACTIVE	2026-08-29 02:23:13.498+00	2026-09-02 22:25:35.859+00
5db84a3e-f483-4667-a7ca-23d9cf50249d	eb25e923-17e3-4ec6-9804-c1bf33139d7e	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2025-03-01	\N	ACTIVE	2026-08-29 02:23:15.129+00	2026-09-02 22:25:36.145+00
4209760c-fa9f-4ed9-a701-05ef616dbaf7	61451526-5906-420c-9d49-ac14b3e7e1e7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-02-01	\N	ACTIVE	2026-08-29 02:23:15.341+00	2026-09-02 22:25:36.268+00
73540a7e-dc2e-46bd-a2d9-0014cf41ba53	ddd1ae0f-e5b1-4aa5-a1e7-5a96798d5786	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-01	\N	ACTIVE	2026-08-29 02:23:14.12+00	2026-09-02 22:25:36.299+00
ee0fa5aa-ecf7-4507-8780-35789ef95a6d	78a30a79-2e8a-497a-a971-98c900e8197e	bcea570e-e3dd-499f-8a4b-88f079773871	2025-11-01	\N	ACTIVE	2026-08-29 02:23:14.619+00	2026-09-02 22:25:36.326+00
85ab018a-b375-4100-846c-48027433d12e	d29a7fa8-7611-4762-94cd-4680bc6ce241	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-03-01	\N	ACTIVE	2026-08-29 02:23:14.928+00	2026-09-02 22:25:36.388+00
26fd9e54-9a6a-4f07-85bd-2a7778561c78	2d77e8b7-c2d6-472c-91b0-c3af17e916e7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-03-01	\N	ACTIVE	2026-08-29 02:23:15.25+00	2026-09-02 22:25:36.505+00
9d584459-467b-46d6-856b-b92873bd7210	dab98409-0209-4981-a923-b964aed7d26f	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-02-01	\N	ACTIVE	2026-08-29 02:23:12.563+00	2026-09-02 22:25:36.538+00
f31bec5c-f1cb-471f-9151-3670c1fd52dc	e775ae54-82f6-431f-8b77-e66485f4d4d8	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-03-01	\N	ACTIVE	2026-08-29 02:23:14.216+00	2026-09-02 22:25:36.631+00
5dfe6754-f87d-4f3f-9d4b-24317f65d117	e775ae54-82f6-431f-8b77-e66485f4d4d8	576c192b-8d45-47e9-bd94-df027445d793	2026-03-01	\N	ACTIVE	2026-08-29 02:23:14.261+00	2026-09-02 22:25:36.662+00
2ca0812d-7f61-446c-9217-cde43fef8629	36fbeaff-eaf4-4acd-bfed-95fe5e3d07c3	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-03-01	\N	ACTIVE	2026-08-29 02:23:13.712+00	2026-09-02 22:25:36.954+00
d03e7b63-654a-4698-9e9f-2b57647a3f3a	6dca4c54-e7dd-421a-bda6-d4881238236d	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-06-01	\N	ACTIVE	2026-08-29 02:23:14.528+00	2026-09-02 22:25:36.986+00
efc63ca6-264a-4c6a-bdbc-f33bfb76ac37	327106db-080d-4a7a-a7d2-b8fee7b19d83	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-06-01	\N	ACTIVE	2026-08-29 02:23:15.156+00	2026-09-02 22:25:37.018+00
2406e794-18c1-4222-b8e5-74518bc30151	d8f72c2c-5e42-4238-801d-6c30ba14b5d2	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-02-01	\N	ACTIVE	2026-08-29 02:23:14.685+00	2026-09-02 22:25:37.072+00
52a50c78-df99-4cd3-88ad-6a6fefea748a	ba9de018-4dcf-4c09-931c-4d569ebdbe1f	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-01-01	\N	ACTIVE	2026-08-29 02:23:14.895+00	2026-09-02 22:25:37.099+00
d59dbdfb-4111-43b4-811b-4a61eeb2bcd2	482fb776-5b73-4d29-b4d9-81ed1db5aa45	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-06-01	\N	ACTIVE	2026-08-29 02:23:14.553+00	2026-09-02 22:25:37.506+00
4fffa97b-98c9-4b9e-9217-2b663efbb14a	afec60cd-8a2d-42c3-8730-ddc64ac4bfcf	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-10-01	\N	ACTIVE	2026-08-29 02:23:08.87+00	2026-09-02 22:25:37.577+00
ddbf6134-fc66-4bc0-990c-13ac16fb23b0	46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-11-01	\N	ACTIVE	2026-08-29 02:23:14.507+00	2026-09-02 22:25:37.674+00
a3f629d5-a079-4e65-9a7b-6b63e52a72b1	46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-11-01	\N	ACTIVE	2026-08-29 02:23:14.467+00	2026-09-02 22:25:37.707+00
ee008ad3-2ebd-4791-8346-6c4e01d616df	46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-11-01	\N	ACTIVE	2026-08-29 02:23:14.43+00	2026-09-02 22:25:37.733+00
af7c7fc8-6289-43bc-a865-3ed87785fe58	0ce33854-cda1-4646-921d-d63a51e672d8	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-04-01	\N	ACTIVE	2026-08-29 02:23:13.931+00	2026-09-02 22:25:37.942+00
7e0b6822-956b-460e-b875-560bd1185249	7042c4d8-7739-41bd-8ae5-676cec196953	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-01-01	\N	ACTIVE	2026-08-29 02:23:14.834+00	2026-09-02 22:25:37.994+00
b8bca902-7b92-48e2-8335-0df4287f7958	431cfc10-dbfd-446e-882a-a07f2f1e70e8	bcea570e-e3dd-499f-8a4b-88f079773871	2025-11-01	\N	ACTIVE	2026-08-29 02:23:15.558+00	2026-09-02 22:25:38.087+00
c18cb91d-7d51-4a6f-a6f2-33c365a57d46	9e6f4296-6c59-4e21-919d-5394e6e48ad2	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-01	\N	ACTIVE	2026-08-29 02:23:14.025+00	2026-09-02 22:25:38.113+00
e252aec7-2d70-4164-b895-d9267304411e	e0e12c86-9b1d-4fd0-914a-62fc37f00dd1	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-02-01	\N	ACTIVE	2026-08-29 02:23:15.589+00	2026-09-02 22:25:38.145+00
3f2cf1c5-8b5c-4b89-95ab-b722d76cd180	77acbe8a-5a4a-4233-842f-a6ec1887d562	bcea570e-e3dd-499f-8a4b-88f079773871	2026-05-01	\N	ACTIVE	2026-08-29 02:23:14.958+00	2026-09-02 22:25:38.206+00
47ae2631-91ee-4ff7-91b1-368a713b932c	54306e75-e1f7-46b7-bc56-81a432fea581	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-05-01	\N	ACTIVE	2026-08-29 02:23:15.22+00	2026-09-02 22:25:38.236+00
24563f81-b88c-4a31-87dc-f99e680794b8	14fa3093-57f8-435a-8f8f-abc4279c6f26	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ACTIVE	2026-08-29 02:23:14.773+00	2026-09-02 22:25:38.286+00
c8ecc0d9-c8fb-49a7-83a7-c5f7b060eb0d	14fa3093-57f8-435a-8f8f-abc4279c6f26	576c192b-8d45-47e9-bd94-df027445d793	2025-01-01	\N	ACTIVE	2026-08-29 02:23:14.712+00	2026-09-02 22:25:38.314+00
94a878eb-5fd1-44e6-8cd2-fc89ea3a5ff7	14fa3093-57f8-435a-8f8f-abc4279c6f26	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-01-01	\N	ACTIVE	2026-08-29 02:23:14.741+00	2026-09-02 22:25:38.343+00
4cba1d2d-a4bf-4c3f-a809-9a783d1a6323	794257b9-33ab-441b-bee9-27812e22be9b	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-05-01	\N	ACTIVE	2026-08-29 02:23:14.183+00	2026-09-02 22:25:38.374+00
ad3d6cb1-4ca4-488b-b0b3-50de931755b2	fb345864-a1e9-4afe-bd89-f7afd399f849	4074b25f-622a-4423-ac82-9d0cf90e3666	2025-02-01	\N	ACTIVE	2026-08-29 02:23:13.745+00	2026-09-02 22:25:38.435+00
aa4de275-e0ef-48ba-9fa3-ac09e7733d87	fb345864-a1e9-4afe-bd89-f7afd399f849	50f07573-4f58-4314-a0aa-e2e2d0feae71	2025-02-01	\N	ACTIVE	2026-08-29 02:23:13.777+00	2026-09-02 22:25:38.466+00
19ba6290-6517-4d0b-b691-c35bbf62ab2f	9d4e1bb6-b6c2-4b23-8a80-535307c3c8eb	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-06-01	\N	ACTIVE	2026-08-29 02:23:15.28+00	2026-09-02 22:25:38.547+00
5ae97a03-0bd7-4ead-af9e-b4b6c0f9ddb0	8aacb8af-ee64-4623-8933-16f754b34eb1	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-11-01	\N	ACTIVE	2026-08-29 02:23:15.188+00	2026-09-02 22:25:38.609+00
c94467c6-5442-46b1-90b4-58e440fd15eb	d820f750-e7f6-4311-a204-a6994384d585	576c192b-8d45-47e9-bd94-df027445d793	2025-05-01	\N	ACTIVE	2026-08-29 02:23:13.583+00	2026-09-02 22:25:38.64+00
efb610bc-02e8-42c2-afc6-30fcac84da8b	d820f750-e7f6-4311-a204-a6994384d585	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-05-01	\N	ACTIVE	2026-08-29 02:23:13.534+00	2026-09-02 22:25:38.672+00
63742952-9ce9-4879-8c78-22dafd4f4255	b2566873-7ef4-4c30-b0b8-6f71f092436e	576c192b-8d45-47e9-bd94-df027445d793	2026-02-01	\N	ACTIVE	2026-08-29 02:23:15.62+00	2026-09-02 22:25:38.709+00
0e123909-bfa4-490e-90ae-530c6e98070f	b17eaffc-65da-459b-85ac-e1ddbde9c54e	bcea570e-e3dd-499f-8a4b-88f079773871	2026-04-01	\N	ACTIVE	2026-08-29 02:23:12.531+00	2026-09-02 22:25:38.788+00
79a3bb65-4169-466b-85cc-217e9625b46f	82ff4d34-ee44-42be-9248-0c68dc00ce14	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-02-01	\N	ACTIVE	2026-08-29 02:23:15.021+00	2026-09-02 22:25:39.048+00
6e5e090d-823b-4292-9ce2-9fdf057c07c3	883d9857-a34a-43cd-8467-bb67ba08d27f	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-06-01	\N	ACTIVE	2026-08-29 02:23:13.679+00	2026-09-02 22:25:39.162+00
d2fb15e4-533a-4cae-9044-e45d7d45dfe2	da3087f6-e133-44b6-b62b-a9c53836e170	bcea570e-e3dd-499f-8a4b-88f079773871	2026-03-01	\N	ACTIVE	2026-08-29 02:23:13.964+00	2026-09-02 22:25:39.511+00
28767b4e-0b0f-4c06-952c-5919375861a7	90d7e5d0-0b7e-458a-8d99-faa82cce9d68	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-06-01	\N	ACTIVE	2026-08-29 02:23:14.993+00	2026-09-02 22:25:39.566+00
bf63fa09-3a9a-4561-a8c7-357ab803500c	c5e570bd-6a3f-4e60-a1bb-c6fa5e823cf2	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-03-01	\N	ACTIVE	2026-08-29 02:23:14.802+00	2026-09-02 22:25:39.804+00
c6701bc0-1dc5-4499-9c0a-f7c0845e20b3	074b51e1-fa83-411b-a297-0971b3e4f074	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-01-01	\N	ACTIVE	2026-08-29 02:23:09.965+00	2026-09-02 22:25:40.036+00
52737ab5-437a-4fd4-897f-05e616d35b82	fcfce898-5c18-4924-93cf-1b7036f11ba5	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	2025-02-01	\N	ENDED	2026-09-02 22:45:57.666+00	2026-09-02 22:45:57.666+00
19909b3d-5b01-4c28-a9bb-ca12155d7112	fcfce898-5c18-4924-93cf-1b7036f11ba5	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-02-01	\N	ENDED	2026-09-02 22:45:57.696+00	2026-09-02 22:45:57.696+00
be4ff6c5-29f6-4707-aebf-8174ccc9f0b7	e0811a68-dd31-4be0-be6c-88be271765d7	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-10-01	\N	ENDED	2026-09-02 22:45:57.739+00	2026-09-02 22:45:57.739+00
1727f3a8-f17e-4bad-92ab-33705fd01145	824df025-def1-46c0-af0e-0477fd7a1719	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-02-01	\N	ENDED	2026-09-02 22:45:57.769+00	2026-09-02 22:45:57.769+00
1bf86f68-66c1-452d-b3f0-29955bbf7fc6	824df025-def1-46c0-af0e-0477fd7a1719	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-02-01	\N	ENDED	2026-09-02 22:45:57.801+00	2026-09-02 22:45:57.801+00
36f41804-f7df-41f0-9148-47b49b4b07ea	bc06e985-bd2a-4319-bf66-8880c6e4e46d	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-10-01	\N	ENDED	2026-09-02 22:45:57.833+00	2026-09-02 22:45:57.833+00
c952a405-2f19-4f97-839a-4b3b690afac7	5f9946ba-3eea-444c-b8aa-664d7686fe6d	576c192b-8d45-47e9-bd94-df027445d793	2025-01-01	\N	ENDED	2026-09-02 22:45:57.863+00	2026-09-02 22:45:57.863+00
0bf6b683-81b0-4c52-89b8-e8e73dcc45b7	5f9946ba-3eea-444c-b8aa-664d7686fe6d	2d17175b-22b0-4565-9342-1e93ad221855	2025-01-01	\N	ENDED	2026-09-02 22:45:57.894+00	2026-09-02 22:45:57.894+00
f8ad12bb-2e92-4ecd-9093-c6804f6c9e5c	220a254e-381b-4236-9c90-c8fa2bae00c3	bcea570e-e3dd-499f-8a4b-88f079773871	2026-03-01	\N	ENDED	2026-09-02 22:45:57.929+00	2026-09-02 22:45:57.929+00
6bda8b66-adbf-4433-bb0b-d0838c920543	088e7435-5cea-4497-a371-6b11fce3c045	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-05-01	\N	ENDED	2026-09-02 22:45:57.959+00	2026-09-02 22:45:57.959+00
f16881e1-58a3-427d-a016-92d33e6d2b64	a4030ecd-e658-4a4d-a015-e7d9302e6d58	2d17175b-22b0-4565-9342-1e93ad221855	2025-02-01	\N	ENDED	2026-09-02 22:45:57.986+00	2026-09-02 22:45:57.986+00
017ce5ed-fcff-4046-b6be-cabd0c737961	c9c8f310-d002-4085-9e15-d05f99db5f0a	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-06-01	\N	ENDED	2026-09-02 22:45:58.005+00	2026-09-02 22:45:58.005+00
7136dc70-a312-4b27-b261-9f88b3c53c5f	f237f4bc-8093-431f-8598-ff503ef70187	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2025-02-01	\N	ENDED	2026-09-02 22:45:58.02+00	2026-09-02 22:45:58.02+00
17f59a10-b6db-4166-b835-dfe08fcbcc4c	997c0e8e-9152-449a-8ffb-9b68a7536349	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-02-01	\N	ENDED	2026-09-02 22:45:58.039+00	2026-09-02 22:45:58.039+00
304619e4-ed41-4819-958e-f5b6b08a21c6	abf306d4-83d7-4467-aa81-6cda65fe4c1d	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-10-01	\N	ENDED	2026-09-02 22:45:58.068+00	2026-09-02 22:45:58.068+00
9bc74f98-3d58-4076-822a-c804c7834e44	c6108d50-a4d4-4193-8305-c3e06b7eaf17	576c192b-8d45-47e9-bd94-df027445d793	2026-05-01	\N	ENDED	2026-09-02 22:45:58.094+00	2026-09-02 22:45:58.094+00
d3de109d-673d-4515-b9a2-e466b7476345	62de9f40-7027-4b13-997f-1ce9106757ce	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-04-01	\N	ENDED	2026-09-02 22:45:58.12+00	2026-09-02 22:45:58.12+00
d85bdd8f-ec24-4bc1-919a-c5a213535c44	1ca2cd22-ac1c-4627-a0f4-8a1ce8bce0be	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-01-01	\N	ENDED	2026-09-02 22:45:58.147+00	2026-09-02 22:45:58.147+00
72e87f7c-1020-4c21-b772-75ca12af2bdb	1ca2cd22-ac1c-4627-a0f4-8a1ce8bce0be	576c192b-8d45-47e9-bd94-df027445d793	2025-01-01	\N	ENDED	2026-09-02 22:45:58.174+00	2026-09-02 22:45:58.174+00
83e0385a-32af-4bfd-9275-ce0f8c1b4471	56bd8b07-68d5-4c19-b828-2bfeb4fbfb3e	bcea570e-e3dd-499f-8a4b-88f079773871	2026-03-01	\N	ENDED	2026-09-02 22:45:58.201+00	2026-09-02 22:45:58.201+00
e5bd086a-e46f-4b28-848e-f247e46824d6	cd7321aa-45a3-4fa8-aa96-79f146db1290	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-10-01	\N	ENDED	2026-09-02 22:45:58.228+00	2026-09-02 22:45:58.228+00
ce0188a5-edb0-4d96-b5c2-a4e2914a60cf	6e71dbbc-029d-45d6-affc-c68fa0e5ccd2	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-10-01	\N	ENDED	2026-09-02 22:45:58.254+00	2026-09-02 22:45:58.254+00
95b5e446-442a-402b-963a-6e2cc6b507ff	61451526-5906-420c-9d49-ac14b3e7e1e7	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-02-01	\N	ENDED	2026-09-02 22:45:58.281+00	2026-09-02 22:45:58.281+00
a030dffc-3e92-414e-a328-f7732cbe1a5f	61451526-5906-420c-9d49-ac14b3e7e1e7	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-02-01	\N	ENDED	2026-09-02 22:45:58.307+00	2026-09-02 22:45:58.307+00
9e90f7cb-9b25-471a-8c11-c97ab26f875f	e7438a66-db50-4610-9fa8-ec00833ed1f0	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-05-01	\N	ENDED	2026-09-02 22:45:58.334+00	2026-09-02 22:45:58.334+00
4181a23e-1970-4d63-a192-1dbfa40bba7c	dd8b06a2-f18b-4a36-b91e-62cd3bb09cf8	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-01	\N	ENDED	2026-09-02 22:45:58.362+00	2026-09-02 22:45:58.362+00
56cf09a1-48bd-43ab-9812-702b0451767b	85a80831-c1f1-4c7e-8198-ee05d349a8f4	bcea570e-e3dd-499f-8a4b-88f079773871	2025-03-01	\N	ENDED	2026-09-02 22:45:58.387+00	2026-09-02 22:45:58.387+00
31f023d5-ebce-429c-af77-32896f547eb9	5661b9ff-03e3-4951-b426-09dc613a59f5	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	2025-05-01	\N	ENDED	2026-09-02 22:45:58.436+00	2026-09-02 22:45:58.436+00
e8f3a343-4e98-41a7-888b-31c03cfd87b6	5661b9ff-03e3-4951-b426-09dc613a59f5	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-05-01	\N	ENDED	2026-09-02 22:45:58.502+00	2026-09-02 22:45:58.502+00
266093a5-a21c-4a46-bd04-41687031a1f5	aebc5d6c-914a-49f6-87b8-3354105f5103	da4d15d9-c846-4098-8640-e95fd97c604f	2025-03-01	\N	ENDED	2026-09-02 22:45:58.535+00	2026-09-02 22:45:58.535+00
5430c4a2-0416-496e-94dc-e51b4ef6e3f9	332b258e-69a8-4cb7-b1cc-75971f504cd3	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-06-01	\N	ENDED	2026-09-02 22:45:58.561+00	2026-09-02 22:45:58.561+00
80bada5e-406b-41f8-94a2-c970c164c97e	2047b20c-6313-4ba5-994b-12b45f3a23ac	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-03-01	\N	ENDED	2026-09-02 22:45:58.587+00	2026-09-02 22:45:58.587+00
c1962b7d-33f1-485d-8e45-9569081f1399	d18fc40a-f574-44de-8d14-6fa56f77b179	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-03-01	\N	ENDED	2026-09-02 22:45:58.614+00	2026-09-02 22:45:58.614+00
7e6b922a-a963-4ad7-ba43-74b4b123cd0f	2d77e8b7-c2d6-472c-91b0-c3af17e916e7	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-03-01	\N	ENDED	2026-09-02 22:45:58.641+00	2026-09-02 22:45:58.641+00
5779d0b7-cb92-44bd-981d-3e7745eb7954	8576617b-4be5-4548-9125-cd2888b9f11c	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-10-01	\N	ENDED	2026-09-02 22:45:58.656+00	2026-09-02 22:45:58.656+00
2044807e-eb67-47a3-b855-a1d05f25ee7e	4ab8b2c4-86d0-4e63-b14c-7b4ef7db62f7	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-06-01	\N	ENDED	2026-09-02 22:45:58.68+00	2026-09-02 22:45:58.68+00
540374b9-6a2f-440e-b518-454882228a89	af5dabec-f6a6-4cea-b71b-924ce22443c8	576c192b-8d45-47e9-bd94-df027445d793	2026-02-01	\N	ENDED	2026-09-02 22:45:58.711+00	2026-09-02 22:45:58.711+00
916c1e22-dcc3-488b-984a-8c9d3396d01b	2966dca5-5db5-4180-846e-aee8a3d8550b	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2025-02-01	\N	ENDED	2026-09-02 22:45:58.734+00	2026-09-02 22:45:58.734+00
29be8ba9-869d-4490-a99d-0261cf31383a	0527d151-0fd0-48b5-ae9f-26d26cd19f3b	ac972b45-74ce-49f8-be10-3a6f0151da82	2025-04-01	\N	ENDED	2026-09-02 22:45:58.761+00	2026-09-02 22:45:58.761+00
f4916477-ff25-4c5a-bfcf-bb3fee6aef98	9199d897-0441-41ef-9396-67575b644e7e	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-06-01	\N	ENDED	2026-09-02 22:45:58.788+00	2026-09-02 22:45:58.788+00
7d78ad9c-72c2-44fb-a3cd-1eff485b9a29	6580c661-c4b4-4c27-9ac0-53c62e941754	7b64e0e6-a347-4734-b2fa-b752fbe92cfb	2025-07-01	\N	ENDED	2026-09-02 22:45:58.815+00	2026-09-02 22:45:58.815+00
e7d8e429-e5a6-4ebc-9a7e-603b32646a2b	a2baa8f1-d52f-4263-aeb2-647c3f2f8e6b	2d17175b-22b0-4565-9342-1e93ad221855	2026-02-01	\N	ENDED	2026-09-02 22:45:58.844+00	2026-09-02 22:45:58.844+00
ca1cd0bd-3e50-4bb2-b686-22c3c1dbf386	5fe8147b-071b-49b8-982d-9841570d3df4	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-04-01	\N	ENDED	2026-09-02 22:45:58.863+00	2026-09-02 22:45:58.863+00
9621f6a6-735f-46c5-898e-87213ed03be7	2896238a-f2a3-4c9b-8ea2-22083e8f59a9	bcea570e-e3dd-499f-8a4b-88f079773871	2025-10-01	\N	ENDED	2026-09-02 22:45:58.879+00	2026-09-02 22:45:58.879+00
ed035b29-8de4-46bc-85c6-ac53b071f8df	ba9de018-4dcf-4c09-931c-4d569ebdbe1f	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-01-01	\N	ENDED	2026-09-02 22:45:58.915+00	2026-09-02 22:45:58.915+00
8a87dae5-e2dd-45b0-a57f-3d3550a95936	cf232c58-308a-419d-a714-b5902b143f2c	bcea570e-e3dd-499f-8a4b-88f079773871	2026-05-01	\N	ENDED	2026-09-02 22:45:58.947+00	2026-09-02 22:45:58.947+00
7237b28b-83c2-41e9-8256-5cc68f5a725b	e42a187e-ef04-45f9-9fd8-8c24a5fcfcdf	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2025-09-01	\N	ENDED	2026-09-02 22:45:58.977+00	2026-09-02 22:45:58.977+00
ee7ea00f-98aa-4621-aaf6-7fc1bd063bbd	e3d42e74-cf95-499a-9ad2-35d0abf7e500	2d17175b-22b0-4565-9342-1e93ad221855	2025-11-01	\N	ENDED	2026-09-02 22:45:58.991+00	2026-09-02 22:45:58.991+00
8a424fd1-143f-40d5-900f-e6731858a921	528f5372-4d0f-4864-92b0-93d8bd6d1a93	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	2025-02-01	\N	ENDED	2026-09-02 22:45:59.013+00	2026-09-02 22:45:59.013+00
78feeceb-4e74-4cf9-9034-fa424a655463	e89fd784-8b1d-4be3-b410-2482f9b94d86	bcea570e-e3dd-499f-8a4b-88f079773871	2025-02-01	\N	ENDED	2026-09-02 22:45:59.045+00	2026-09-02 22:45:59.045+00
007ac4be-d884-4726-9311-36ab08e146a6	4ba9a189-06e0-4787-8dd3-edf55ec58a22	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-02-01	\N	ENDED	2026-09-02 22:45:59.077+00	2026-09-02 22:45:59.077+00
ce152949-50f6-4869-bc68-e7c6e95cefa7	e9b4b1f5-1d06-4ad3-b102-76554c3d5581	cc392129-75e3-4205-b7fc-fafceb55b996	2025-03-01	\N	ENDED	2026-09-02 22:45:59.119+00	2026-09-02 22:45:59.119+00
6191d1ac-b618-4ede-bace-6c9aed4cbde4	9a062ed6-c4fe-4cf6-b590-8a04240d57fd	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2025-10-01	\N	ENDED	2026-09-02 22:45:59.152+00	2026-09-02 22:45:59.152+00
549561c0-b1a0-4227-a2ed-69ce9876e2e8	6523d623-9d87-4ab5-a632-765da7d2e604	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	2025-03-01	\N	ENDED	2026-09-02 22:45:59.188+00	2026-09-02 22:45:59.188+00
e6495508-5564-431d-9fc9-1a8ffb8b168a	6523d623-9d87-4ab5-a632-765da7d2e604	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2025-03-01	\N	ENDED	2026-09-02 22:45:59.232+00	2026-09-02 22:45:59.232+00
0352fb4c-ded1-4e2d-8ecf-13d62220df59	595b3f8d-4997-478f-8bd9-f6f10ac6fe00	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-06-01	\N	ENDED	2026-09-02 22:45:59.263+00	2026-09-02 22:45:59.263+00
97432f15-947e-442c-ad91-1d2502159c45	3df5c6f2-82e5-4b28-a2ed-310573216eaa	da4d15d9-c846-4098-8640-e95fd97c604f	2026-02-01	\N	ENDED	2026-09-02 22:45:59.279+00	2026-09-02 22:45:59.279+00
b2d2f6f4-ebac-4898-959c-a372299efd86	354818ea-b773-4be4-92d5-548f2fc48f82	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-06-01	\N	ENDED	2026-09-02 22:45:59.298+00	2026-09-02 22:45:59.298+00
9e1271ca-0e5e-48ab-a1c1-cfc70bca45f7	4266485a-8c0a-41b5-bc21-8b3c0b5c0123	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-03-01	\N	ENDED	2026-09-02 22:45:59.318+00	2026-09-02 22:45:59.318+00
fe49655f-c53a-4cbf-b5b8-ebd4ff95f82d	4266485a-8c0a-41b5-bc21-8b3c0b5c0123	576c192b-8d45-47e9-bd94-df027445d793	2026-03-01	\N	ENDED	2026-09-02 22:45:59.333+00	2026-09-02 22:45:59.333+00
815662fb-2c19-4dc3-92a2-13a30bafed03	b081171b-df46-4671-8679-cdb140896300	bcea570e-e3dd-499f-8a4b-88f079773871	2025-03-01	\N	ENDED	2026-09-02 22:45:59.349+00	2026-09-02 22:45:59.349+00
2abe3100-dc24-4148-a477-203c7d69dcb9	8f82478a-a7b6-4960-853c-cf371cead592	bcea570e-e3dd-499f-8a4b-88f079773871	2025-06-01	\N	ENDED	2026-09-02 22:45:59.365+00	2026-09-02 22:45:59.365+00
9f4b0bb6-50a6-4d18-8bde-a8c5fb3ca426	394dab71-975b-44a5-97a1-9f2771beb52e	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-06-01	\N	ENDED	2026-09-02 22:45:59.387+00	2026-09-02 22:45:59.387+00
8ff43903-81d2-4367-8810-6b4626f0c01b	2dee74ee-8d96-435d-9919-796132c2c721	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2025-02-01	\N	ENDED	2026-09-02 22:45:59.403+00	2026-09-02 22:45:59.403+00
144f4489-4c14-49f9-9b2a-59e6b3c471c7	27df3a27-a07e-4a5b-8b17-27c3cc47ae55	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2026-02-01	\N	ENDED	2026-09-02 22:45:59.435+00	2026-09-02 22:45:59.435+00
2ee1659e-5758-4b92-aea7-fb3c0c0bbc59	43bb40a7-3e58-417c-b486-0c4ddb7822ff	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-02-01	\N	ENDED	2026-09-02 22:45:59.452+00	2026-09-02 22:45:59.452+00
c75e4482-1018-4453-abae-73400630985e	43bb40a7-3e58-417c-b486-0c4ddb7822ff	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-02-01	\N	ENDED	2026-09-02 22:45:59.468+00	2026-09-02 22:45:59.468+00
d1664f68-dc81-419f-8dde-abe37a9d2f61	43bb40a7-3e58-417c-b486-0c4ddb7822ff	576c192b-8d45-47e9-bd94-df027445d793	2025-02-01	\N	ENDED	2026-09-02 22:45:59.483+00	2026-09-02 22:45:59.483+00
91a0172d-0b96-4d95-b940-cbab71432051	e0e12c86-9b1d-4fd0-914a-62fc37f00dd1	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2025-02-01	\N	ENDED	2026-09-02 22:45:59.499+00	2026-09-02 22:45:59.499+00
aaac8451-d66f-4bf5-9077-2b1f0e587d77	7f5c0637-0f59-4fbd-b65f-cf09cbb25687	576c192b-8d45-47e9-bd94-df027445d793	2025-01-01	\N	ENDED	2026-09-02 22:45:59.518+00	2026-09-02 22:45:59.518+00
1c1d9ab6-ca28-46f0-89ad-02fe45872ee9	7f5c0637-0f59-4fbd-b65f-cf09cbb25687	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ENDED	2026-09-02 22:45:59.534+00	2026-09-02 22:45:59.534+00
2bb911ac-9e4f-435e-97c2-357d426cbc01	90f5e1a8-2c50-404a-bacc-a85b6546541e	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-07-01	\N	ENDED	2026-09-02 22:45:59.549+00	2026-09-02 22:45:59.549+00
ddbd9f7e-52dd-47b6-b72a-2252d00359c7	578ec62c-5e6f-4ad0-8d28-f2a4117c4aba	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-06-01	\N	ENDED	2026-09-02 22:45:59.564+00	2026-09-02 22:45:59.564+00
a1af6247-425d-4f56-9c63-b7439e3d57e0	0185c457-daad-4f7b-86cd-132fe29eb79b	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-10-01	\N	ENDED	2026-09-02 22:45:59.587+00	2026-09-02 22:45:59.587+00
00ce605b-e9a0-4266-9c24-bc1652d75fe7	fb345864-a1e9-4afe-bd89-f7afd399f849	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	2025-02-01	\N	ENDED	2026-09-02 22:45:59.602+00	2026-09-02 22:45:59.602+00
127ea4cd-e6ec-4e49-beb6-8579b2748cb3	16443c47-5f93-49d5-8fc2-0b8e8eed17a6	576c192b-8d45-47e9-bd94-df027445d793	2026-03-01	\N	ENDED	2026-09-02 22:45:59.616+00	2026-09-02 22:45:59.616+00
891c485c-73f7-49c4-abfc-772fd679b870	93eb3719-9602-4843-bded-dd9b84d8fc85	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-05-01	\N	ENDED	2026-09-02 22:45:59.635+00	2026-09-02 22:45:59.635+00
79589376-db43-47df-9981-27dff47fe0ab	91b5b534-5e64-46fe-8cf2-af0d6cd19375	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-01	\N	ENDED	2026-09-02 22:45:59.667+00	2026-09-02 22:45:59.667+00
aeb20f93-7bd0-4a3b-b5b9-f515e3bc5378	bf22c095-e25d-45d8-bec9-c162e867c7a5	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-01-01	\N	ENDED	2026-09-02 22:45:59.698+00	2026-09-02 22:45:59.698+00
b6559bfc-2c0c-4225-b85e-9b2fa2e1bfc1	bf22c095-e25d-45d8-bec9-c162e867c7a5	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-01-01	\N	ENDED	2026-09-02 22:45:59.719+00	2026-09-02 22:45:59.719+00
e916218b-56e7-4b72-ad95-58a5659cefc5	644fcc38-1091-4820-af7d-0ea909f2f7d3	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-03-01	\N	ENDED	2026-09-02 22:45:59.734+00	2026-09-02 22:45:59.734+00
4ba1794e-c421-43e1-becc-6afb77d55034	02e64ebe-65ee-419e-a706-e27ce4705d26	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-05-01	\N	ENDED	2026-09-02 22:45:59.751+00	2026-09-02 22:45:59.751+00
4802eefc-7491-4f09-ae58-bb19b6599ae4	3000ba63-6b94-4117-ac49-b864162e5c98	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-01-01	\N	ENDED	2026-09-02 22:45:59.766+00	2026-09-02 22:45:59.766+00
0e12bd4a-3cfd-4572-bc3f-6bcc128a1a69	eabdb8b6-3845-4fd0-b251-194ce48cc7d5	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-01	\N	ENDED	2026-09-02 22:45:59.788+00	2026-09-02 22:45:59.788+00
2a7a923e-a080-4301-aedc-688b439c9ead	7f6b993b-3935-4a20-b017-75a8c8956f48	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-06-01	\N	ENDED	2026-09-02 22:45:59.814+00	2026-09-02 22:45:59.814+00
a211df19-0be6-4974-8114-efcbb3806271	161530a6-02b6-40ea-a32d-1d7df44b787b	bcea570e-e3dd-499f-8a4b-88f079773871	2025-03-01	\N	ENDED	2026-09-02 22:45:59.846+00	2026-09-02 22:45:59.846+00
406652b4-06c3-448e-83bf-a6f49ee80c7b	8456df92-458f-4081-9a21-e926ef940a0e	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-10-01	\N	ENDED	2026-09-02 22:45:59.896+00	2026-09-02 22:45:59.896+00
32b9d96f-4358-4e5b-8ea6-ec633173debc	832092f8-877d-4980-81c8-3a992b980b23	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-06-01	\N	ENDED	2026-09-02 22:45:59.97+00	2026-09-02 22:45:59.97+00
60dc32fd-7c42-4159-a749-0711f92932c7	f2aae84b-e156-4d9d-81f3-d50a56e02255	2d17175b-22b0-4565-9342-1e93ad221855	2025-01-01	\N	ENDED	2026-09-02 22:46:00.004+00	2026-09-02 22:46:00.004+00
38fba932-bc81-4739-bdfe-7bd8df909f0c	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-01-01	\N	ENDED	2026-09-02 22:46:00.021+00	2026-09-02 22:46:00.021+00
82315bd5-196e-40a5-a82b-684ed52efbbd	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-01-01	\N	ENDED	2026-09-02 22:46:00.053+00	2026-09-02 22:46:00.053+00
db893ccf-e649-4804-b448-01ee54583131	27152b91-3376-464f-b17b-b011d278918f	e63b18a1-afc2-4fd1-aa80-dfce8909e30f	2025-01-01	\N	ENDED	2026-09-02 22:46:00.099+00	2026-09-02 22:46:00.099+00
bb2e3df5-386f-481e-ae65-6d7fab8b036a	27152b91-3376-464f-b17b-b011d278918f	0dd78cf5-7a17-455c-9a70-1175a12d327d	2025-01-01	\N	ENDED	2026-09-02 22:46:00.12+00	2026-09-02 22:46:00.12+00
1ffe2d92-debe-4d28-bde5-deef14d88d93	c38fe8da-7530-42c4-bc42-257b2a3f947d	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-04-01	\N	ENDED	2026-09-02 22:46:00.152+00	2026-09-02 22:46:00.152+00
98aef5ad-3b7b-4cda-9c47-a75eb04e37c8	a7c74644-d186-44fb-917b-3882623523b9	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-02-01	\N	ENDED	2026-09-02 22:46:00.19+00	2026-09-02 22:46:00.19+00
63b3da60-5426-4bfb-9313-46857f7fc42c	4f2227bd-707f-4fbe-8531-649359533dac	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2025-01-01	\N	ENDED	2026-09-02 22:46:00.221+00	2026-09-02 22:46:00.221+00
8d5aafc1-6f91-40cf-aeac-c382825a1cc0	8aed5d20-bbe6-4316-b78b-0e6cd9de1ace	bcea570e-e3dd-499f-8a4b-88f079773871	2025-06-01	\N	ENDED	2026-09-02 22:46:00.236+00	2026-09-02 22:46:00.236+00
68cfa185-c39b-4ee8-83de-6e341bf953bb	0525fe97-d116-4493-b08b-5e9406256a33	acbbc26b-2a55-4952-97a0-92dc025024d2	2025-02-01	\N	ENDED	2026-09-02 22:46:00.268+00	2026-09-02 22:46:00.268+00
ea2fad69-bde2-4df0-a9e1-f648dc238fa3	03d84eb6-75ca-4c8e-b8a7-b1afa2506408	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2025-09-01	\N	ENDED	2026-09-02 22:46:00.3+00	2026-09-02 22:46:00.3+00
2700287e-e327-4977-8ab6-01bcd51fddbc	03d84eb6-75ca-4c8e-b8a7-b1afa2506408	06f93e1a-5cc0-4741-8ad6-813745ea389d	2025-09-01	\N	ENDED	2026-09-02 22:46:00.321+00	2026-09-02 22:46:00.321+00
f8f879e8-e7b6-4baf-bd3a-aac9b6b33dd0	03d84eb6-75ca-4c8e-b8a7-b1afa2506408	576c192b-8d45-47e9-bd94-df027445d793	2025-09-01	\N	ENDED	2026-09-02 22:46:00.347+00	2026-09-02 22:46:00.347+00
60a932dd-4ca0-494e-8ab9-77f9508ec57d	14c2fc1f-9bf8-44b5-8143-d38a5204f6e8	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-02-01	\N	ENDED	2026-09-02 22:46:00.363+00	2026-09-02 22:46:00.363+00
7886ff5b-3bc0-4683-9ccc-a6ce3390f1d7	331355b9-731b-4ae6-9e2d-a8de8c43c837	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2025-02-01	\N	ENDED	2026-09-02 22:46:00.39+00	2026-09-02 22:46:00.39+00
3a2da978-a772-4bb0-a5bd-645c332ae049	331355b9-731b-4ae6-9e2d-a8de8c43c837	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2025-02-01	\N	ENDED	2026-09-02 22:46:00.422+00	2026-09-02 22:46:00.422+00
94c8152a-6cf6-41fe-ad5f-a0493ea0d5f7	8de58389-ee6e-4750-8e63-2cbd68647d78	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-05-01	\N	ENDED	2026-09-02 22:46:00.474+00	2026-09-02 22:46:00.474+00
8c90f912-7a19-4502-9645-85a61fd83042	a0c222dc-ca48-46f8-ba14-e862c38ffd9f	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-01	\N	ENDED	2026-09-02 22:46:00.54+00	2026-09-02 22:46:00.54+00
785f606b-9b28-4cc0-b772-31802c3d9eac	dbd63745-e037-438b-a665-88df5347b07c	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-07-01	\N	ENDED	2026-09-02 22:46:00.608+00	2026-09-02 22:46:00.608+00
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.leads (id, name, phone, normalized_phone, email, normalized_email, instagram, normalized_instagram, source, status, notes, next_follow_up_at, last_contact_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: monthly_charge_adjustments; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.monthly_charge_adjustments (id, monthly_charge_id, source_condition_id, type, calculation, configured_value, effective_amount, student_amount_delta, settlement_base_delta, teacher_id, authorized_by_user_id, created_by_user_id, reason, reversal_of_id, created_at) FROM stdin;
\.


--
-- Data for Name: monthly_charges; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.monthly_charges (id, student_id, enrollment_id, tariff_id, period, base_amount, discount_amount, final_amount, due_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_allocations; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.payment_allocations (id, payment_id, monthly_charge_id, amount, created_at) FROM stdin;
\.


--
-- Data for Name: payment_tenders; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.payment_tenders (id, payment_id, method, amount, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.payments (id, student_id, amount, status, paid_at, created_by_user_id, voided_at, voided_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.rooms (id, name, capacity, branch_id, status, created_at, updated_at) FROM stdin;
1b22371d-3ab7-4c8f-9579-96cf4e466f8c	Salón 2	20	12661d97-3998-4789-a9e5-44d72c5c7513	ACTIVE	2026-08-23 18:58:06.141+00	2026-08-23 19:58:33.275+00
7224e2cf-3eb5-4dcf-b086-aed42eabbff4	Salón principal	35	12661d97-3998-4789-a9e5-44d72c5c7513	ACTIVE	2026-08-21 23:38:57.666+00	2026-08-23 19:58:37.889+00
\.


--
-- Data for Name: student_attendances; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.student_attendances (id, enrollment_id, attendance_date, status, notes, created_at, updated_at) FROM stdin;
cedad1ca-9004-439a-860c-6fa87f6ec290	c914adaf-c8ad-4bef-91e6-8228b41698b1	2026-08-21	ABSENT	falto	2026-08-22 01:09:20.263+00	2026-08-22 01:09:20.263+00
1b3a6bda-f111-4f5c-b58f-fb8f774a4ada	a1cd8d8b-f092-4b40-9644-509c3e71b55a	2026-08-21	JUSTIFIED	Presentó justificativo	2026-08-21 23:59:53.123+00	2026-08-22 01:09:20.284+00
0e6074d0-e31d-491d-bd6a-98cd5dc20e13	a1cd8d8b-f092-4b40-9644-509c3e71b55a	2026-08-22	JUSTIFIED	presento justificacion	2026-08-22 01:02:37.061+00	2026-08-22 01:09:51.976+00
8405e1be-91b5-4afd-9e6d-8a74df5b8225	c914adaf-c8ad-4bef-91e6-8228b41698b1	2026-08-22	ABSENT	hola	2026-08-22 01:02:37.061+00	2026-08-22 01:09:51.976+00
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.students (id, dni, first_name, last_name, birth_date, phone, email, address, joined_at, status, created_at, updated_at) FROM stdin;
ddc77860-17e6-4310-a399-7ea7365f3ccb	0000000	alumno	prueba2	2002-12-30	2222222	.@gmail.com	aaaaa	2026-08-21	INACTIVE	2026-08-21 21:12:46.787+00	2026-08-28 23:10:29.771+00
454a2da4-1337-4d63-bc8c-676b36c2098f	31482126	SILVANA	GUERRA	\N	5493704973776	\N	LA RIOJA 405	2026-08-28	ACTIVE	2026-08-28 23:07:35.038+00	2026-08-28 23:07:35.038+00
1eb674f1-d0c8-4e43-9414-f322dac17aa3	34034154	NOEMI	TOLOSA	1983-12-23	5493705016277	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.052+00	2026-08-28 23:07:35.052+00
997c0e8e-9152-449a-8ffb-9b68a7536349	25228859	CLAUDIA	CABRERA	1980-07-15	5493704683555	\N	PADRE GROTTI 430	2026-08-28	ACTIVE	2026-08-28 23:07:35.074+00	2026-08-28 23:07:35.074+00
a6104629-708b-46d0-9b13-5d074bcbed25	13647051	GRACIELA	DELALOYE	1958-08-09	5493704718715	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.088+00	2026-08-28 23:07:35.088+00
fc1308bd-fc2d-474e-ab5e-688a861d6ab6	55588759	ZAIRA	SANCHEZ	2016-10-05	5493704710944	\N	B° simon bolivar m12 c13	2026-08-28	ACTIVE	2026-08-28 23:07:35.115+00	2026-08-28 23:07:35.115+00
2eaa7af6-8603-44a1-a71a-2407b668372a	12428786	AMADO	CANTON	\N	5493704660640	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.125+00	2026-08-28 23:07:35.125+00
bfd88cee-ae21-47f2-b6dd-72d57b145b31	55916624	DYLAN ALEXIS	ALARCON	2017-04-20	5493704507494	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.15+00	2026-08-28 23:07:35.15+00
42e15f9c-7320-4458-9d43-d755b9fb8a03	16461866	CARMEN GEREZ NANCI	DEL	1963-10-31	5493704363500	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.163+00	2026-08-28 23:07:35.163+00
79224b93-2a40-4d0e-85ee-caec0d3c3a01	41270463	JULIETA	FERNANDESZ	1998-12-30	5493705201340	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.177+00	2026-08-28 23:07:35.177+00
afec60cd-8a2d-42c3-8730-ddc64ac4bfcf	39720762	MAIRA	LUGO	1996-10-06	5493704545461	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.189+00	2026-08-28 23:07:35.189+00
4d6a3455-1ce6-44d8-846e-382899d35c73	35625143	MARIA ROSA	BERNAL	1990-10-15	5493704260255	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.203+00	2026-08-28 23:07:35.203+00
9cb09f48-0770-4af1-b9cf-54fae1fd15ef	18701064	JOSE LUIS	BELTRAN	1955-10-10	5493704662356	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.216+00	2026-08-28 23:07:35.216+00
ceec123a-5d45-44fa-a3d5-f325ebd18cd0	5666587	ESTHER	GAUNA	1948-09-01	5493704687517	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.229+00	2026-08-28 23:07:35.229+00
2d2d8459-38c0-4d13-8c4e-217789edcce0	52499283	AVRIL	CORTEZ	2013-02-04	5493704697829	\N	LIBERTAD 985 B°DON BOSCO	2026-08-28	ACTIVE	2026-08-28 23:07:35.26+00	2026-08-28 23:07:35.26+00
d9a7a5b9-cad3-45a6-9499-44d0e4fe8ce8	58841098	LUANA	CASTILLO	2021-06-22	5493704643869	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.283+00	2026-08-28 23:07:35.283+00
a7c74644-d186-44fb-917b-3882623523b9	58631617	EVANGELINA	SOSA	2020-11-14	5493704871717	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.296+00	2026-08-28 23:07:35.296+00
c047fbfa-5531-4b7f-ac51-d00609133285	54951947	BENICIO	FABIO	2016-04-20	5493704816022	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.31+00	2026-08-28 23:07:35.31+00
e3d42e74-cf95-499a-9ad2-35d0abf7e500	29082064	JORGE	LASPIUR	1981-10-03	5493704615449	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.324+00	2026-08-28 23:07:35.324+00
e535d5fc-d1f4-4e83-a5eb-47bca35ad4d2	57879421	AGUILAR BRUNO BENJAMIN	MONZON	2019-10-20	5493704546372	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.336+00	2026-08-28 23:07:35.336+00
7a0da8cb-aeef-49cb-a4be-3773436f945a	10176061	BEATRIZ	ROSSI	\N	5493704782854	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.35+00	2026-08-28 23:07:35.35+00
e85c8d41-7f2f-44ac-a122-5fac5e2f7463	17358647	MARTA	AGUERO	\N	5493704371834	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.359+00	2026-08-28 23:07:35.359+00
6523d623-9d87-4ab5-a632-765da7d2e604	27254602	CLAUDIA	LOPEZ	1979-04-07	5493704512374	\N	25 DE MAYO MZ 5 C32	2026-08-28	ACTIVE	2026-08-28 23:07:35.377+00	2026-08-28 23:07:35.377+00
220a254e-381b-4236-9c90-c8fa2bae00c3	56314515	SOFIA CONSTANZA	BALBUENA	2017-10-31	5493704673597	\N	santa rosa	2026-08-28	ACTIVE	2026-08-28 23:07:35.39+00	2026-08-28 23:07:35.39+00
a38e7370-fee4-4345-93ac-cf6ae5006b9a	57513554	GUILLERMINA	ARANDA	2019-03-24	5493704782305	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.403+00	2026-08-28 23:07:35.403+00
15dccc6f-7cc5-475b-9704-768d3f3b7bcb	34219846	MARINA	BAEZ	1969-06-02	5493704251593	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.413+00	2026-08-28 23:07:35.413+00
ae113266-bea6-4ec2-b7ab-9841fbe7bde5	58262775	ARGUELLO CAMILA	FLORES	2020-05-27	5493704300912	\N	B SAN FRANCISCO	2026-08-28	ACTIVE	2026-08-28 23:07:35.43+00	2026-08-28 23:07:35.43+00
d9d2c6a8-42e8-45d8-a549-6f553ae8a4c2	36205813	SABRINA	MIÑOS	1992-02-18	5493704775130	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.457+00	2026-08-28 23:07:35.457+00
824df025-def1-46c0-af0e-0477fd7a1719	24780042	FLAVIA	AQUINO	\N	5493704709584	\N	FOTHERINGAM646	2026-08-28	ACTIVE	2026-08-28 23:07:35.47+00	2026-08-28 23:07:35.47+00
a3a92c1a-d667-4962-b1a1-3c1ac3c5f365	56315675	FLORENCIA	SERVIN	2017-08-04	5493704261353	\N	lote 4	2026-08-28	ACTIVE	2026-08-28 23:07:35.484+00	2026-08-28 23:07:35.484+00
08c5343e-fc53-41ed-bd41-05429bd7995b	57878092	MARTINA	ALVAREZ	2019-09-20	5493704775130	\N	nueva formosa mz6 csa 9	2026-08-28	ACTIVE	2026-08-28 23:07:35.497+00	2026-08-28 23:07:35.497+00
408771b7-b499-4521-bb0d-ac790af66da1	14827549	YAMILE	YEGE	\N	5493704781317	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.509+00	2026-08-28 23:07:35.509+00
d609ebd0-85ea-45c8-aae0-c8ad16036947	59185667	MARTINA ANGELES	CORONEL	2022-04-16	5493704672669	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.523+00	2026-08-28 23:07:35.523+00
9967814e-bd85-4322-8516-09b903de0237	31670257	ACOSTA DEBORA	CABRERA	2024-06-03	5493704019548	\N	EL PORVENIR M64 C 4	2026-08-28	ACTIVE	2026-08-28 23:07:35.536+00	2026-08-28 23:07:35.536+00
25c63902-bc14-4221-a549-441c09cf4768	54266359	PATRI GAIA	FERNANDEZ	2014-11-10	5493704686060	\N	Sarmiento 436	2026-08-28	ACTIVE	2026-08-28 23:07:35.55+00	2026-08-28 23:07:35.55+00
45cd7c0b-1f2f-435a-947a-f1301d2f99a3	16168458	VICTOR HUGO	SANABRIA	\N	5493704696664	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.563+00	2026-08-28 23:07:35.563+00
27152b91-3376-464f-b17b-b011d278918f	30854724	NOELIA	SORAIRE	1984-04-05	5493704550061	\N	jose maria uriburu 2764	2026-08-28	ACTIVE	2026-08-28 23:07:35.576+00	2026-08-28 23:07:35.576+00
074b51e1-fa83-411b-a297-0971b3e4f074	28099029	MAGALI	WIERNES	\N	5493704706301	\N	AV LOS PAREISOS 154	2026-08-28	ACTIVE	2026-08-28 23:07:35.59+00	2026-08-28 23:07:35.59+00
c9d07213-f8ad-40f2-b459-2be739cc05b7	41606958	ALBA	IRALA	1999-04-14	5493704801972	\N	BARRIO REP.ARG	2026-08-28	ACTIVE	2026-08-28 23:07:35.602+00	2026-08-28 23:07:35.602+00
8456df92-458f-4081-9a21-e926ef940a0e	36205100	SABRINA	SCHAAB	1992-07-27	5493704968868	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.617+00	2026-08-28 23:07:35.617+00
97e34e29-16e6-4644-aa44-0f7c88dba8aa	29080503	PATRICIA	MEDINA	1981-08-22	5493704413149	\N	PARAGUAY 1940	2026-08-28	ACTIVE	2026-08-28 23:07:35.63+00	2026-08-28 23:07:35.63+00
5a8926bc-871e-4beb-a27e-91c00f38f67c	53790015	ARGUELLO VALENTINA	FLORES	2014-01-20	5493704300912	\N	B SAN FRACISCO	2026-08-28	ACTIVE	2026-08-28 23:07:35.657+00	2026-08-28 23:07:35.657+00
ce69fede-102f-4ba9-9ee8-5a9889f98676	51211292	MARTINA	SANCHEZ	2011-07-23	5493704261051	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.67+00	2026-08-28 23:07:35.67+00
aa6f3582-c3be-4632-a28b-6a52572af725	53960039	GUILLERMINA	BARNICHEA	2014-06-18	5493704590737	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.684+00	2026-08-28 23:07:35.684+00
4e6cb7ef-a16e-46a8-9e0c-9f72abd6c513	55122363	BENITEZ MAIA	AYALA	2016-04-14	5493704252760	\N	BARRIO LOTE 110	2026-08-28	ACTIVE	2026-08-28 23:07:35.696+00	2026-08-28 23:07:35.696+00
0138b18b-e037-47a5-ae52-fbe92f0ac7ff	24140567	GRACIELA	CIGEL	1974-11-20	5493704571194	\N	vicente posadas 1835	2026-08-28	ACTIVE	2026-08-28 23:07:35.71+00	2026-08-28 23:07:35.71+00
6290ccdb-2615-4ba3-a563-e55e6f5333b9	54582578	HAZEL	MADRID	2023-08-19	5493704381724	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.723+00	2026-08-28 23:07:35.723+00
7f5c0637-0f59-4fbd-b65f-cf09cbb25687	29080950	ROMINA	PAREDES	1981-10-07	5493704342860	\N	BARRIO ILLIA 2 MZ 42 CSAS 16	2026-08-28	ACTIVE	2026-08-28 23:07:35.736+00	2026-08-28 23:07:35.736+00
e2f3404c-63d7-4c3b-b434-45549922ea59	59105995	OLIVIA	LUCERO	2022-01-22	5493704364299	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.75+00	2026-08-28 23:07:35.75+00
fe2876e4-6433-4d44-a5e3-89a8a0d67433	52264248	URSULA	FLORES	2012-06-26	5493704715208	\N	B.DON BOSCO	2026-08-28	ACTIVE	2026-08-28 23:07:35.763+00	2026-08-28 23:07:35.763+00
df2e9a16-b155-43e6-9ffd-e70c5026481b	95818738	NEYDES	BENEGAS	1998-11-03	5493704787487	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.782+00	2026-08-28 23:07:35.782+00
5661b9ff-03e3-4951-b426-09dc613a59f5	37799520	CECILIA VANINA	DUARTE	1993-08-19	5493704697870	\N	B°la paz mz 11 csa 165 sector A	2026-08-28	ACTIVE	2026-08-28 23:07:35.804+00	2026-08-28 23:07:35.804+00
89b51d7f-4a99-4805-8f75-13b32420f8f0	41383292	CELENE	GONZALEZ	1998-12-13	5493705013341	\N	cordoba 820	2026-08-28	ACTIVE	2026-08-28 23:07:35.813+00	2026-08-28 23:07:35.813+00
40950d87-dc66-405f-9295-7b0625b592aa	57687953	HAYLLI ALAIA	MADRID	2019-07-05	5493704381724	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.83+00	2026-08-28 23:07:35.83+00
f2aae84b-e156-4d9d-81f3-d50a56e02255	24537072	ARIEL	SORABELLA	1974-11-09	5493704571603	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.857+00	2026-08-28 23:07:35.857+00
d5c24860-da44-4c74-b22a-97bdf8f42c22	51380522	FATIMA	TOPACIO	\N	5493704546589	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.87+00	2026-08-28 23:07:35.87+00
b8bae188-1b10-4118-8cd3-e97cfd4aeec5	18815763	ANALIA	AYALA	1980-12-31	5493704644224	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.883+00	2026-08-28 23:07:35.883+00
9254f230-7913-4feb-be5c-1264137f3b9a	48349528	ANGELINA	INSFRAN	2008-12-11	5493704412573	\N	mitre 335	2026-08-28	ACTIVE	2026-08-28 23:07:35.897+00	2026-08-28 23:07:35.897+00
16c93792-8688-4a6d-89d3-ca97e4ad944f	55589231	ORIANA	VALLEJOS	2016-06-08	5493704802605	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.91+00	2026-08-28 23:07:35.91+00
64a99306-c339-401e-8461-d2c2f93b0c61	58631698	SCHMELING AUSTIN	VON	2021-01-17	5493704280970	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.926+00	2026-08-28 23:07:35.926+00
8bed59f3-936a-4fdd-bf39-475c686481b7	11111111	alumno	prueba	2001-11-11	222222	222@gmail.com	aaaa	2026-08-22	INACTIVE	2026-08-22 01:01:58.898+00	2026-08-28 23:09:58.962+00
674c8e8e-1a1d-4c62-9785-16d526fd3c95	52143128	TATIANA	TORRES	2012-02-07	5493705016278	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.952+00	2026-08-28 23:07:35.952+00
d60d7504-4213-45c0-9757-7646d010dd1a	57144605	IRUPE	LOPEZ	2018-09-02	5493704064064	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.976+00	2026-08-28 23:07:35.976+00
440f71df-52eb-4c53-9b3a-a7ee701c29ba	58841036	LUANA MAILEN	QUIROGA	2021-04-15	5493704544758	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:35.99+00	2026-08-28 23:07:35.99+00
dd5e52c4-3ac5-468c-b81e-32744f518de8	53960342	NAHIARA	GUTIERRES	2014-09-09	5493704032173	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.003+00	2026-08-28 23:07:36.003+00
d5bd7500-6267-473f-aa6a-1d5f129fe33c	58841053	GUILLERMINA	PEREIRA	2021-05-28	5493704993529	\N	B° EL MISTOL1 M87 C4	2026-08-28	ACTIVE	2026-08-28 23:07:36.016+00	2026-08-28 23:07:36.016+00
56bd8b07-68d5-4c19-b828-2bfeb4fbfb3e	56614045	VIRGINIA ISABELLA	CAZAL	2017-10-09	5493704602895	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.03+00	2026-08-28 23:07:36.03+00
a337c9c9-e4e9-4fdb-a634-b7a84d3ede86	56617580	ALISSE	MERELES	\N	5493704647386	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.062+00	2026-08-28 23:07:36.062+00
fcfce898-5c18-4924-93cf-1b7036f11ba5	35058454	MILVA EDITH	ACOSTA	1990-04-14	5493704808404	\N	pantaleon gomez 1536	2026-08-28	ACTIVE	2026-08-28 23:07:36.088+00	2026-08-28 23:07:36.088+00
2896238a-f2a3-4c9b-8ea2-22083e8f59a9	56310473	VIERA PILAR	GONZALEZ	2018-10-10	5493704670857	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.11+00	2026-08-28 23:07:36.11+00
26ec3b0a-5193-465e-9d38-45cfb38ae0b3	53790120	EMMA	SOSA	2014-04-09	5493704963121	\N	Berutti 77	2026-08-28	ACTIVE	2026-08-28 23:07:36.123+00	2026-08-28 23:07:36.123+00
4deb1a11-1f3b-47f4-940d-f6bdfbc54840	29080223	NATALIA	SORAIRE	\N	5493704691790	\N	JOSE MARIA URIBURU 436	2026-08-28	ACTIVE	2026-08-28 23:07:36.137+00	2026-08-28 23:07:36.137+00
757fbdf4-80af-4d43-ae09-fb75ece1a012	54267180	BENITEZ LUZ MIA	AYALA	2014-12-10	5493704252760	\N	BARRIO 110	2026-08-28	ACTIVE	2026-08-28 23:07:36.15+00	2026-08-28 23:07:36.15+00
528f5372-4d0f-4864-92b0-93d8bd6d1a93	33456164	JOHANNA	LEGUIZAMON	1988-01-20	5493704663870	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.163+00	2026-08-28 23:07:36.163+00
8d18ee38-ca45-4ee5-af25-2df796d371eb	52499761	FRANCESCA	MENAPACCE	2013-03-17	5493704503777	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.176+00	2026-08-28 23:07:36.176+00
064dfa74-0e77-44eb-901f-93e457ef4a65	58841172	OLIVIA	HERNANDEZ	2021-07-08	5493704298643	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.186+00	2026-08-28 23:07:36.186+00
955a0573-f1c3-4810-84bd-f657fd6b734c	40486420	TURCO RITA	DEL	\N	5493704859268	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.203+00	2026-08-28 23:07:36.203+00
9a24244d-0c3b-461b-95c7-57d682862292	55915777	JOSEFINA NICOLE	VERA	2017-04-03	5493704343103	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.217+00	2026-08-28 23:07:36.217+00
aa4f35db-ca8b-4829-ab74-60c57521f462	56974010	GOMEZ RAYSSA	VALDEZ	2018-05-18	5493704541714	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.23+00	2026-08-28 23:07:36.23+00
287e8a09-5b0b-40e6-8c30-3fb6c065dbff	55590091	TERESITA CECILIA	SOLIS	2016-10-07	5493704579946	\N	B° Incone m19 c109	2026-08-28	ACTIVE	2026-08-28 23:07:36.248+00	2026-08-28 23:07:36.248+00
5bb9359d-768a-4cce-a92c-16a95641759f	57288151	ALMA	SOSA	2019-01-11	5491131421629	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.27+00	2026-08-28 23:07:36.27+00
f237f4bc-8093-431f-8598-ff503ef70187	23730114	CLAUDIA	CABALLERO	\N	5493704566300	\N	J.J SILVA 2240	2026-08-28	ACTIVE	2026-08-28 23:07:36.283+00	2026-08-28 23:07:36.283+00
668965b1-0738-4249-b880-ac0dff06a17b	42036829	RUTH	CELLIO	\N	5493704858981	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.296+00	2026-08-28 23:07:36.296+00
bbfad32d-4feb-40a4-8fea-90c12297c9d7	12383090	JUDITH	BARRIOS	1956-07-11	5493704660290	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.31+00	2026-08-28 23:07:36.31+00
598cc625-80fc-4755-acd8-a4d0f57e7641	54584203	NICOLE	BAUZA	2015-06-15	5493704394401	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.323+00	2026-08-28 23:07:36.323+00
1071b1bd-3026-4810-b527-6d33437e99cd	54583527	NAYELI	CANO	2015-03-03	5493704047561	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.34+00	2026-08-28 23:07:36.34+00
e131203a-d7c6-40a0-bcd4-062e41335e8f	53960378	DELFINA	APONTE	2014-10-14	5493704612765	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.365+00	2026-08-28 23:07:36.365+00
808556f1-82dc-46fb-b058-5f13582c4b8f	28248389	MARIA DEL CARMEN	ROJAS	1980-08-26	5493704375718	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.38+00	2026-08-28 23:07:36.38+00
f0bf368a-4c7b-40a1-9ce3-c7f4719efec9	55588608	NOAH BENJAMIN	GAUNA	2016-08-26	5493704095434	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.392+00	2026-08-28 23:07:36.392+00
8a27a773-fda2-4bd2-ac79-caaf4bf972fe	21307309	RAMONA	SOSA	1970-03-30	5493704690325	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.403+00	2026-08-28 23:07:36.403+00
b0bb2d93-1d20-4cf3-8867-2250bd830889	53793087	DELFINA	VILLALBA	\N	5493704083909	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.43+00	2026-08-28 23:07:36.43+00
f20f54d6-ebcc-4829-b110-67f0c1c7aae1	56314137	VIOLETA	CORTI	2017-12-29	5493704280229	\N	TERRIO NAC.881	2026-08-28	ACTIVE	2026-08-28 23:07:36.457+00	2026-08-28 23:07:36.457+00
ff5d8b46-3458-40cd-a9a8-9b47fc500d33	26211779	NATALIA SOLEDAD	GIMENEZ	1989-11-21	5493704803089	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.47+00	2026-08-28 23:07:36.47+00
f78f638a-546b-4e50-afc4-d54f655bf96a	51084762	-TANGO CAMILA	FLORES	2011-05-27	5493704080231	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.484+00	2026-08-28 23:07:36.484+00
18c12bef-a4e7-4fc1-854a-91c8347c48f9	16138846	DELFINA	GIMENEZ	1962-06-20	5493704675461	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.498+00	2026-08-28 23:07:36.498+00
ddf38b55-0d22-466e-b13c-c67a1631f7f3	57392291	CELENNE GERALDINE	FERNANDEZ	2018-12-19	5493705003873	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.509+00	2026-08-28 23:07:36.509+00
8ecb69c8-daf6-4b1b-869b-348c8cd2d4a1	51084755	CARABAJAL ODOLIA VALENTINA	SOMACAL	2011-05-26	5493704572028	\N	santa rosa	2026-08-28	ACTIVE	2026-08-28 23:07:36.523+00	2026-08-28 23:07:36.523+00
132b2658-c520-4be0-9f93-93827720fdf1	35488161	ROCIO	RIVAS	1990-06-21	5493704285203	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.537+00	2026-08-28 23:07:36.537+00
0304d8cf-6f00-41a8-a675-b98592bafb97	29244884	LOURDES	VALDOVINO	1982-06-08	5493704203465	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.55+00	2026-08-28 23:07:36.55+00
fc282a39-09ec-494f-a177-ccba97d90797	35897819	VIVIANA	SALINAS	1992-04-23	5493704026692	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.563+00	2026-08-28 23:07:36.563+00
bfa38797-b517-4143-b7d1-0c893df2af11	38577460	KATIA	EYMANN	1995-05-22	5493704264854	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.577+00	2026-08-28 23:07:36.577+00
c6108d50-a4d4-4193-8305-c3e06b7eaf17	30776636	ELIZABETH	CANDIA	1984-04-03	5493704526832	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.586+00	2026-08-28 23:07:36.586+00
b17eaffc-65da-459b-85ac-e1ddbde9c54e	57514810	DOMINGUEZ EMA	ROMERO	2019-04-27	5493704644952	\N	carlos ayala 921	2026-08-28	ACTIVE	2026-08-28 23:07:36.596+00	2026-08-28 23:07:36.596+00
dab98409-0209-4981-a923-b964aed7d26f	53792917	SELENE	FLORENTIN	2014-07-23	5493704841145	\N	B°8 DE OCTUBRE M5 C7	2026-08-28	ACTIVE	2026-08-28 23:07:36.616+00	2026-08-28 23:07:36.616+00
0f66f0ff-d9e6-4195-94bb-060aeafe2502	53096978	ABIGAIL	SALINAS	2013-06-22	5493704956304	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.63+00	2026-08-28 23:07:36.63+00
161530a6-02b6-40ea-a32d-1d7df44b787b	56327046	PAULINA	SAPORITTI	2017-06-28	5493624188522	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.656+00	2026-08-28 23:07:36.656+00
790eae5e-6087-40a6-b640-651843ec4646	56310356	UMA GUILLERMINA	ULIAMBRE	2017-06-16	5493704814640	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.67+00	2026-08-28 23:07:36.67+00
b68131ac-a62d-411a-b2ed-5ebe901a5ab8	59767910	AMALIA ALFONSINA	SAPORITI	2023-03-21	5493624188522	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.683+00	2026-08-28 23:07:36.683+00
88dcb0b7-845e-4f80-9584-ab11d60786d0	58081123	FRANCHESCA	GAUTO	2019-12-20	5493704035387	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.697+00	2026-08-28 23:07:36.697+00
85a80831-c1f1-4c7e-8198-ee05d349a8f4	56314099	CATALINA	DUARTE	2017-12-07	5493704259438	\N	B°28 viviendas c20	2026-08-28	ACTIVE	2026-08-28 23:07:36.71+00	2026-08-28 23:07:36.71+00
60ffaac9-4651-41d0-8f32-23d99aa67420	20057294	CLARISA	LESME	1968-03-10	5493704386700	\N	MAIPU 545	2026-08-28	ACTIVE	2026-08-28 23:07:36.723+00	2026-08-28 23:07:36.723+00
c976f4cf-e794-4697-a578-76e46a4d7c57	39605453	FLORENCIA	CELLIO	1996-05-17	5493718589067	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.737+00	2026-08-28 23:07:36.737+00
daada42a-8ccb-40ad-b8c8-66f65dcf2a39	95726481	LUCAS	GAMARRA	\N	5493704011044	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.75+00	2026-08-28 23:07:36.75+00
29244aa1-ed07-4256-903a-b69d13078eab	43068530	DIANA BELEN	RUIZ	2000-10-04	5493704077138	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.76+00	2026-08-28 23:07:36.76+00
e6d631b5-ec70-460b-9835-66eabfb66176	24449820	EVA NANCY	LOMBARDO	1975-01-09	5493704709071	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.776+00	2026-08-28 23:07:36.776+00
21220e88-5f94-4c2b-9a9d-b3c0b21c3c44	16340742	CELESTINA	RUDDY	1963-05-15	5493704556466	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.79+00	2026-08-28 23:07:36.79+00
218e3a17-234c-4b08-81df-613ece4a4606	4913629	LUZ	RIOS	2009-04-21	5493704577538	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.803+00	2026-08-28 23:07:36.803+00
d1667b8b-ac3a-4f37-8e6b-4b75dc5f1418	57514625	PAULINA	MARTINEZ	2019-03-20	5493704674574	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.817+00	2026-08-28 23:07:36.817+00
9890b644-50c6-47a6-9ff4-ced2356cfa6b	29688673	FANNY	BARRETO	1982-09-21	5493704294366	\N	barrio guadalupe t.16 d c	2026-08-28	ACTIVE	2026-08-28 23:07:36.83+00	2026-08-28 23:07:36.83+00
2167fac4-4feb-42cb-815d-a3f9a7b2e2c8	52270796	MICHELIS AZUL	DE	2012-12-21	5493704832752	\N	b°la nueva formosa c66 m19	2026-08-28	ACTIVE	2026-08-28 23:07:36.857+00	2026-08-28 23:07:36.857+00
6a556835-d1d2-4a99-8888-3e47ae0cc87c	57879441	AVRIL	RIOS	2019-11-01	5493624831283	\N	FONTANA 1239	2026-08-28	ACTIVE	2026-08-28 23:07:36.87+00	2026-08-28 23:07:36.87+00
c9987164-f80e-4908-af0b-ccd57b667bd7	36957871	ROCIO	MENDEZ	1992-09-02	5493704714994	\N	BENEZ SARPIE 1425	2026-08-28	ACTIVE	2026-08-28 23:07:36.883+00	2026-08-28 23:07:36.883+00
6617b5c0-3cc9-4197-b7ed-d9bd279a674f	28015342	LEONARDO	AMARILLA	\N	5493704278838	\N	b san isidro ladrador	2026-08-28	ACTIVE	2026-08-28 23:07:36.897+00	2026-08-28 23:07:36.897+00
a6360973-3706-48fd-8f1c-8cba57b53f8d	27577104	GABRIELA	ALARCON	1979-06-09	5493704244032	\N	emilio senes 1845	2026-08-28	ACTIVE	2026-08-28 23:07:36.91+00	2026-08-28 23:07:36.91+00
88f8e49f-6866-4aa4-8a6c-20a69ce1b7f4	39320125	SELENE AYELEN	CANEPA	1996-02-05	5493704926222	\N	b san miguel	2026-08-28	ACTIVE	2026-08-28 23:07:36.924+00	2026-08-28 23:07:36.924+00
d820f750-e7f6-4311-a204-a6994384d585	17313402	MARTIN	RIVAROLA	\N	5493704294449	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.937+00	2026-08-28 23:07:36.937+00
e0d23592-89d1-42df-a4b5-a726468411be	54749685	PIA	CABRERA	\N	5493704985901	\N	b°Republica Arg.m157 c5	2026-08-28	ACTIVE	2026-08-28 23:07:36.95+00	2026-08-28 23:07:36.95+00
b081171b-df46-4671-8679-cdb140896300	56615624	AGUSTINA	MENDOZA	2018-05-02	5493704554490	\N	B°evita m102 c14	2026-08-28	ACTIVE	2026-08-28 23:07:36.967+00	2026-08-28 23:07:36.967+00
883d9857-a34a-43cd-8467-bb67ba08d27f	29565404	CYNTHIA	SCRIBANO	1982-07-02	5493704561123	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:36.99+00	2026-08-28 23:07:36.99+00
36fbeaff-eaf4-4acd-bfed-95fe5e3d07c3	16374176	ANA MARIA	GOMEZ	1963-02-08	5493704684406	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.004+00	2026-08-28 23:07:37.004+00
fb345864-a1e9-4afe-bd89-f7afd399f849	43000787	AGUSTINA	RAMIREZ	2001-03-19	5491164726318	\N	CARLOS CASTAÑEDA 5090	2026-08-28	ACTIVE	2026-08-28 23:07:37.017+00	2026-08-28 23:07:37.017+00
a8eb74e2-1946-460f-be24-c9f4466e9d7c	14827445	GLADIS	ACOSTA	1962-01-28	5493704697300	\N	nicolas avellaneda 946	2026-08-28	ACTIVE	2026-08-28 23:07:37.031+00	2026-08-28 23:07:37.031+00
022f2847-381c-4541-891f-0f38253235f5	31406123	MABEL	BARBIERI	1985-03-12	5493704806466	\N	santo mariguetti 532	2026-08-28	ACTIVE	2026-08-28 23:07:37.072+00	2026-08-28 23:07:37.072+00
7ad17a5c-8489-4f01-858b-b171b6282e03	46066124	CONSTANZA	SALINAS	2005-01-05	5493704012524	\N	barrio nueva formosa mz 53 csa1	2026-08-28	ACTIVE	2026-08-28 23:07:37.106+00	2026-08-28 23:07:37.106+00
1e53518b-8e46-4670-a5c6-72c101b35134	33625473	FLORENCIA ANDREA	BRIGNOLE	1988-08-10	5493704694593	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.132+00	2026-08-28 23:07:37.132+00
0ce33854-cda1-4646-921d-d63a51e672d8	48559960	FATIMA ARIADNA	MENDEZ	2008-03-26	5493704844794	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.174+00	2026-08-28 23:07:37.174+00
da3087f6-e133-44b6-b62b-a9c53836e170	57143503	LIÑAN ANTONIA	SOSA	2018-09-15	5493704363264	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.205+00	2026-08-28 23:07:37.205+00
5a2db33a-7b69-4246-9b6f-b882dfd79764	6133631	SCHROL	OLIVERA	1949-08-04	5493705054586	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.246+00	2026-08-28 23:07:37.246+00
9e6f4296-6c59-4e21-919d-5394e6e48ad2	33588166	SOLEDAD	OLIVA	1988-06-06	5491134369093	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.278+00	2026-08-28 23:07:37.278+00
a4030ecd-e658-4a4d-a015-e7d9302e6d58	37044962	DANIEL	BENITEZ	1993-05-09	5493704613691	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.3+00	2026-08-28 23:07:37.3+00
ddd1ae0f-e5b1-4aa5-a1e7-5a96798d5786	36205396	MAGALI	DELLAGNOLO	1992-11-10	5493704374331	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.327+00	2026-08-28 23:07:37.327+00
f1998bf5-63a4-4990-b367-82d4124a9cdf	38192502	MARIA SOLEDAD	AGUILAR	1994-05-06	5493704546372	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.353+00	2026-08-28 23:07:37.353+00
794257b9-33ab-441b-bee9-27812e22be9b	58958016	SOFIA	PINO	2021-07-19	5493704360292	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.379+00	2026-08-28 23:07:37.379+00
e775ae54-82f6-431f-8b77-e66485f4d4d8	41607743	GUADALUPE	FLORES	1999-06-15	5493718669737	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.39+00	2026-08-28 23:07:37.39+00
32a952d0-5c16-456e-be91-e928d6ca4eef	29484376	MARIA ANGELICA	BRITEZ	\N	5493704367800	\N	AV FRONDIZI 4983	2026-08-28	ACTIVE	2026-08-28 23:07:37.403+00	2026-08-28 23:07:37.403+00
21c54b2e-1542-4f84-a96d-1758f848b973	44036265	ALEJANDRA	GONZALEZ	2002-04-23	5493704217651	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.416+00	2026-08-28 23:07:37.416+00
e89fd784-8b1d-4be3-b410-2482f9b94d86	56615529	ISABELLA	LEIVA	2018-01-02	5493704204340	\N	parque urbano 1 mz83 csa 19	2026-08-28	ACTIVE	2026-08-28 23:07:37.43+00	2026-08-28 23:07:37.43+00
46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	37534846	CECILIA	MEDINA	1993-06-21	5493704580419	\N	SARMIENTO 125	2026-08-28	ACTIVE	2026-08-28 23:07:37.471+00	2026-08-28 23:07:37.471+00
6dca4c54-e7dd-421a-bda6-d4881238236d	58996865	DANNA GUADALUPE	GOMEZ	2021-09-30	5493704211990	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.514+00	2026-08-28 23:07:37.514+00
482fb776-5b73-4d29-b4d9-81ed1db5aa45	54266184	MIA PRICILA	LUCERO	2014-12-01	5493705044515	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.534+00	2026-08-28 23:07:37.534+00
7384e63e-d9e2-4c9c-818b-d98579f2dba8	16928892	LILIANA BEATRIZ	ACUÑA	1964-10-25	5493704551637	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.549+00	2026-08-28 23:07:37.549+00
78a30a79-2e8a-497a-a971-98c900e8197e	58166661	FRANCESCA	DIARTE	\N	5493705150610	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.564+00	2026-08-28 23:07:37.564+00
df69102b-aa50-44da-8cac-a0e502072582	39607144	SANDRA	BAEZ	1996-05-17	5493704065545	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.577+00	2026-08-28 23:07:37.577+00
d8f72c2c-5e42-4238-801d-6c30ba14b5d2	54268908	ISABELLA	GONZALEZ	2015-02-04	5493705104679	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.593+00	2026-08-28 23:07:37.593+00
14fa3093-57f8-435a-8f8f-abc4279c6f26	17968431	NORA HAIRE	PEREIRA	1966-10-03	5493704803809	\N	AV GUZNIKI 1754	2026-08-28	ACTIVE	2026-08-28 23:07:37.621+00	2026-08-28 23:07:37.621+00
c5e570bd-6a3f-4e60-a1bb-c6fa5e823cf2	55916841	ABYGAIL	VALLEJOS	2017-03-14	5493704709215	\N	B SAN JUAN 2	2026-08-28	ACTIVE	2026-08-28 23:07:37.64+00	2026-08-28 23:07:37.64+00
7042c4d8-7739-41bd-8ae5-676cec196953	56615745	LEIRE	MIÑO	2018-04-27	5493704553768	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.656+00	2026-08-28 23:07:37.656+00
793d1985-0bcc-4d43-93be-fd4df9cf2e39	55123018	JULIETA	ARGAMONTE	1980-02-22	5493705059557	\N	LOTE 111 M56 C5	2026-08-28	ACTIVE	2026-08-28 23:07:37.671+00	2026-08-28 23:07:37.671+00
ba9de018-4dcf-4c09-931c-4d569ebdbe1f	46522992	MATTEO NAVILA	GUARE	2006-07-19	5493705218895	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.68+00	2026-08-28 23:07:37.68+00
d29a7fa8-7611-4762-94cd-4680bc6ce241	22192232	SUNNY	DUARTE	1970-04-09	5493704716884	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.697+00	2026-08-28 23:07:37.697+00
77acbe8a-5a4a-4233-842f-a6ec1887d562	5614738	SOL	PEART	2018-03-10	5493704592659	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.71+00	2026-08-28 23:07:37.71+00
90d7e5d0-0b7e-458a-8d99-faa82cce9d68	55915519	VICTORIA	SOSA	2017-02-11	5493716507206	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.724+00	2026-08-28 23:07:37.724+00
82ff4d34-ee44-42be-9248-0c68dc00ce14	53246415	ORTIZ DELFINA	SANCHEZ	2013-08-10	5493704021614	\N	PADRE GROTTI 630	2026-08-28	ACTIVE	2026-08-28 23:07:37.737+00	2026-08-28 23:07:37.737+00
7155ff13-ed1e-40fc-af42-d30383691132	50193211	DELFINA	BORDON	2010-12-09	5493704833479	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.75+00	2026-08-28 23:07:37.75+00
8f82478a-a7b6-4960-853c-cf371cead592	56615679	MERCEDES	MOLINA	2018-05-26	5493704603492	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.763+00	2026-08-28 23:07:37.763+00
8aed5d20-bbe6-4316-b78b-0e6cd9de1ace	55917250	TEDIN AGUSTINA	SOSA	2017-08-23	5493704780994	\N	pasifico escosina 1249	2026-08-28	ACTIVE	2026-08-28 23:07:37.777+00	2026-08-28 23:07:37.777+00
eb25e923-17e3-4ec6-9804-c1bf33139d7e	43712041	ALENKA	CUQUEJO	2001-12-03	5493704267210	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.79+00	2026-08-28 23:07:37.79+00
327106db-080d-4a7a-a7d2-b8fee7b19d83	55591217	ANGEL	GONZALEZ	2016-11-12	5493704678408	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.8+00	2026-08-28 23:07:37.8+00
8aacb8af-ee64-4623-8933-16f754b34eb1	54266283	GUILLERMINA	RIQUELME	2015-01-11	5493704068159	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.817+00	2026-08-28 23:07:37.817+00
54306e75-e1f7-46b7-bc56-81a432fea581	48343373	SOFIA	PEÑA	2008-02-18	5493704565635	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.83+00	2026-08-28 23:07:37.83+00
2d77e8b7-c2d6-472c-91b0-c3af17e916e7	36669916	MARIA JOSE	FLEITAS	1992-01-16	5493704253210	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.858+00	2026-08-28 23:07:37.858+00
9d4e1bb6-b6c2-4b23-8a80-535307c3c8eb	55121355	GOMEZ NICOL	RIOS	2015-12-22	5493704723020	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.871+00	2026-08-28 23:07:37.871+00
c4cbc2b3-137b-4a1d-918a-69d45e26f725	48275789	EUGENIA	BULLON	2008-08-26	5493704394745	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.882+00	2026-08-28 23:07:37.882+00
61451526-5906-420c-9d49-ac14b3e7e1e7	25229222	MARIA CARLA	DELGADO	\N	5493704813800	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.897+00	2026-08-28 23:07:37.897+00
c3e2f29d-7147-4ffd-967b-ec3c9472b6ac	48147245	MARISOL	BENITEZ	2008-06-08	5493704668826	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.91+00	2026-08-28 23:07:37.91+00
a5f67efa-a60d-465c-996d-acc357010e3b	34349858	FATIMA	BERNAL	1989-04-24	5493704772885	\N	MARTIN FIERRO 1176	2026-08-28	ACTIVE	2026-08-28 23:07:37.924+00	2026-08-28 23:07:37.924+00
b48cbe49-b182-45ec-a845-5a64ef0ab8b7	26081295	SOLEDAD	CESPEDES	\N	5493718663352	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.935+00	2026-08-28 23:07:37.935+00
bc06e985-bd2a-4319-bf66-8880c6e4e46d	40839209	FLORENCIA	AQUINO	1997-12-30	5493704368028	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.951+00	2026-08-28 23:07:37.951+00
431cfc10-dbfd-446e-882a-a07f2f1e70e8	58081437	ISABELLA	NOVELLO	2020-01-03	5493704416049	\N	JULIO ARG. ROCA 225	2026-08-28	ACTIVE	2026-08-28 23:07:37.964+00	2026-08-28 23:07:37.964+00
e0e12c86-9b1d-4fd0-914a-62fc37f00dd1	43807580	MAGALI	OVIEDO	2001-12-21	5493705023603	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.977+00	2026-08-28 23:07:37.977+00
b2566873-7ef4-4c30-b0b8-6f71f092436e	34030745	LUCAS SEBASTIAN	ROJAS	1989-09-06	5493704003535	\N	\N	2026-08-28	ACTIVE	2026-08-28 23:07:37.992+00	2026-08-28 23:07:37.992+00
f5ca223e-79ec-4546-a181-36a488589191	54267174	SOFIA	CHAMORRO	2009-12-09	5493704682266	-@hotmail.com	ECHEGARAY 269	2026-08-28	ACTIVE	2026-08-28 23:17:24.28+00	2026-08-28 23:17:24.28+00
e0811a68-dd31-4be0-be6c-88be271765d7	900000001	MICAELA	ALBARRACIN	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.225+00	2026-09-02 22:24:12.246+00
5f9946ba-3eea-444c-b8aa-664d7686fe6d	900000002	CRISTIAN	ARMOA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.28+00	2026-09-02 22:24:12.294+00
bd4533b9-c38a-4df2-b4b9-e6a0c8ced4bb	900000003	GUSTAVO	BARBOZA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.305+00	2026-09-02 22:24:12.32+00
088e7435-5cea-4497-a371-6b11fce3c045	900000004	LAURA	BAY	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.331+00	2026-09-02 22:24:12.356+00
c9c8f310-d002-4085-9e15-d05f99db5f0a	900000005	JUANA	BENITEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.394+00	2026-09-02 22:24:12.414+00
630d576f-5360-40b8-95ce-965a4f9a41dc	900000006	AGOSTINA MICAELA	CABALLERO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.439+00	2026-09-02 22:24:12.458+00
abf306d4-83d7-4467-aa81-6cda65fe4c1d	900000007	AGOSTINA	CACERES FERNANDEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.485+00	2026-09-02 22:24:12.505+00
62de9f40-7027-4b13-997f-1ce9106757ce	900000008	MIA	CARRERA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.517+00	2026-09-02 22:24:12.54+00
1ca2cd22-ac1c-4627-a0f4-8a1ce8bce0be	900000009	CAMILA	CASTILLO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.551+00	2026-09-02 22:24:12.588+00
cd7321aa-45a3-4fa8-aa96-79f146db1290	900000010	YAMILA	CENTURION	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.61+00	2026-09-02 22:24:12.629+00
7328ff49-6386-41f6-ac7a-7e7808697bd6	900000011	CLAUDIA BEATRIZ	D AUGERO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.657+00	2026-09-02 22:24:12.716+00
6e71dbbc-029d-45d6-affc-c68fa0e5ccd2	900000012	MELISA	DE LOS SANTOS	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.763+00	2026-09-02 22:24:12.785+00
f3ab44dd-f9c9-4a0a-8297-954e9fb04117	900000013	AZUL	DE MICHIELIS	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.81+00	2026-09-02 22:24:12.827+00
dc44e246-c8db-48b2-9710-4ab57615b347	900000014	AITANA NICOL	DEL VALLE	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.853+00	2026-09-02 22:24:12.881+00
eb1a1c31-27f5-454d-b23e-83f171d59f6b	900000015	CAMILA	DELLAGNOLO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.903+00	2026-09-02 22:24:12.92+00
e7438a66-db50-4610-9fa8-ec00833ed1f0	900000016	AYELEN	DIAZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.943+00	2026-09-02 22:24:12.96+00
dd8b06a2-f18b-4a36-b91e-62cd3bb09cf8	900000017	NAHUEL	DOMINGUEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:12.995+00	2026-09-02 22:24:13.052+00
aebc5d6c-914a-49f6-87b8-3354105f5103	900000018	GUILIANA	DUARTE	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.079+00	2026-09-02 22:24:13.096+00
332b258e-69a8-4cb7-b1cc-75971f504cd3	900000019	JOAQUINA	ELLI	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.12+00	2026-09-02 22:24:13.14+00
2047b20c-6313-4ba5-994b-12b45f3a23ac	900000020	PATRICIO	ENCISO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.151+00	2026-09-02 22:24:13.174+00
d18fc40a-f574-44de-8d14-6fa56f77b179	900000021	LETICIA AILEN	FERNANDEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.197+00	2026-09-02 22:24:13.214+00
8576617b-4be5-4548-9125-cd2888b9f11c	900000022	TERESA	FLEITAS	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.239+00	2026-09-02 22:24:13.253+00
4ab8b2c4-86d0-4e63-b14c-7b4ef7db62f7	900000023	ANAPAULA	GALEANO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.277+00	2026-09-02 22:24:13.291+00
af5dabec-f6a6-4cea-b71b-924ce22443c8	900000024	SILVIA	GALEANO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.303+00	2026-09-02 22:24:13.321+00
3afe25e0-e4f6-499a-97c9-558179fbf02b	900000025	FRANCESCA	GAUTO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.346+00	2026-09-02 22:24:13.359+00
2966dca5-5db5-4180-846e-aee8a3d8550b	900000026	GERARDO	OBREGON	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.37+00	2026-09-02 22:24:13.389+00
0527d151-0fd0-48b5-ae9f-26d26cd19f3b	900000027	GABRIELA	GIMENEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.412+00	2026-09-02 22:24:13.427+00
9199d897-0441-41ef-9396-67575b644e7e	900000028	KIARA	GIMENEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.455+00	2026-09-02 22:24:13.47+00
51c0bc75-327c-41f7-bcd9-2c1dbe7f83e5	900000029	GISSELLA	MIQUEL	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.49+00	2026-09-02 22:24:13.504+00
6580c661-c4b4-4c27-9ac0-53c62e941754	900000030	PATRICIA	GLERIA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.516+00	2026-09-02 22:24:13.534+00
a2baa8f1-d52f-4263-aeb2-647c3f2f8e6b	900000031	FEDERICO ADRIAN	GOMEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.546+00	2026-09-02 22:24:13.575+00
5fe8147b-071b-49b8-982d-9841570d3df4	900000032	MONICA	GONZALEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.599+00	2026-09-02 22:24:13.613+00
b0364a68-55f7-45bb-a2f8-121b0330fdeb	900000033	VANESA	INSAURRALDE	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.641+00	2026-09-02 22:24:13.659+00
cf232c58-308a-419d-a714-b5902b143f2c	900000034	YASLIN	ISASI	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.679+00	2026-09-02 22:24:13.698+00
e42a187e-ef04-45f9-9fd8-8c24a5fcfcdf	900000035	EUGENIA ROSELY	LAGRAÑA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.71+00	2026-09-02 22:24:13.765+00
4ba9a189-06e0-4787-8dd3-edf55ec58a22	900000036	ARIANA	LEPEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.81+00	2026-09-02 22:24:13.852+00
e9b4b1f5-1d06-4ad3-b102-76554c3d5581	900000037	OMAR	LEYES	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.882+00	2026-09-02 22:24:13.899+00
9a062ed6-c4fe-4cf6-b590-8a04240d57fd	900000038	MARTINA	LO CURCIO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.939+00	2026-09-02 22:24:13.959+00
15d4419b-004a-4a05-9130-bff521459113	900000039	ANDREA ISABEL	LUQUE	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:13.986+00	2026-09-02 22:24:14.006+00
595b3f8d-4997-478f-8bd9-f6f10ac6fe00	900000040	STEFANIA	MARTINEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.033+00	2026-09-02 22:24:14.053+00
3df5c6f2-82e5-4b28-a2ed-310573216eaa	900000041	GIULIANA	MATTEO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.064+00	2026-09-02 22:24:14.08+00
354818ea-b773-4be4-92d5-548f2fc48f82	900000042	ERIK	MEDINA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.103+00	2026-09-02 22:24:14.121+00
4266485a-8c0a-41b5-bc21-8b3c0b5c0123	900000043	YANI	MEDINA PATIÑO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.138+00	2026-09-02 22:24:14.159+00
394dab71-975b-44a5-97a1-9f2771beb52e	900000044	KAREN	MONTIEL	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.195+00	2026-09-02 22:24:14.238+00
2dee74ee-8d96-435d-9919-796132c2c721	900000045	LAURA	MONYO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.274+00	2026-09-02 22:24:14.32+00
6b13f068-8818-4a06-afa1-0f823c14c584	900000046	ALEJANDRA	MORCILLO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.365+00	2026-09-02 22:24:14.415+00
27df3a27-a07e-4a5b-8b17-27c3cc47ae55	900000047	JORGE	OJEDA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.426+00	2026-09-02 22:24:14.437+00
43bb40a7-3e58-417c-b486-0c4ddb7822ff	900000048	ELIDA	ORRABALIS	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.458+00	2026-09-02 22:24:14.47+00
90f5e1a8-2c50-404a-bacc-a85b6546541e	900000049	NAHIARA	PENAYO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.489+00	2026-09-02 22:24:14.51+00
578ec62c-5e6f-4ad0-8d28-f2a4117c4aba	900000050	PRISCILA	PERALTA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.54+00	2026-09-02 22:24:14.56+00
0185c457-daad-4f7b-86cd-132fe29eb79b	900000051	LAURA	QUINTANA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.587+00	2026-09-02 22:24:14.606+00
16443c47-5f93-49d5-8fc2-0b8e8eed17a6	900000052	CELESTE	RAMIREZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.617+00	2026-09-02 22:24:14.637+00
93eb3719-9602-4843-bded-dd9b84d8fc85	900000053	TATIANA	RAMOA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.649+00	2026-09-02 22:24:14.668+00
91b5b534-5e64-46fe-8cf2-af0d6cd19375	900000054	MAIA	REYES	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.68+00	2026-09-02 22:24:14.7+00
bf22c095-e25d-45d8-bec9-c162e867c7a5	900000055	MAXI	REYES	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.711+00	2026-09-02 22:24:14.73+00
644fcc38-1091-4820-af7d-0ea909f2f7d3	900000056	ANDREA	RIGONATO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.746+00	2026-09-02 22:24:14.765+00
02e64ebe-65ee-419e-a706-e27ce4705d26	900000057	MARIANA	RIOS	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.777+00	2026-09-02 22:24:14.796+00
3000ba63-6b94-4117-ac49-b864162e5c98	900000058	KARLA AGOSTINA	RIVAS	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.824+00	2026-09-02 22:24:14.843+00
eabdb8b6-3845-4fd0-b251-194ce48cc7d5	900000059	ROMINA	RIVERO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.854+00	2026-09-02 22:24:14.874+00
639d4c47-7cdb-4d17-a606-46cd152dc99c	900000060	RENATTA	ROLDAN	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.886+00	2026-09-02 22:24:14.906+00
7f6b993b-3935-4a20-b017-75a8c8956f48	900000061	FLORENCIA	RUIZ DIAZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.917+00	2026-09-02 22:24:14.943+00
832092f8-877d-4980-81c8-3a992b980b23	900000062	ILEANA	SILVERA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:14.972+00	2026-09-02 22:24:14.991+00
c38fe8da-7530-42c4-bc42-257b2a3f947d	900000063	PAOLA	SORAIRE	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.019+00	2026-09-02 22:24:15.037+00
4f2227bd-707f-4fbe-8531-649359533dac	900000064	LORENA	SOSA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.066+00	2026-09-02 22:24:15.081+00
0525fe97-d116-4493-b08b-5e9406256a33	900000065	NATALIA	VELAZQUEZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.104+00	2026-09-02 22:24:15.122+00
03d84eb6-75ca-4c8e-b8a7-b1afa2506408	900000066	ANALIA	VIERA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.14+00	2026-09-02 22:24:15.16+00
14c2fc1f-9bf8-44b5-8143-d38a5204f6e8	900000067	VALERIA	VILLA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.184+00	2026-09-02 22:24:15.201+00
331355b9-731b-4ae6-9e2d-a8de8c43c837	900000068	LUCIANA	VILLAGRA	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.213+00	2026-09-02 22:24:15.231+00
8de58389-ee6e-4750-8e63-2cbd68647d78	900000069	LORENA	VILLAMAYOR	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.242+00	2026-09-02 22:24:15.262+00
a0c222dc-ca48-46f8-ba14-e862c38ffd9f	900000070	YANINA	ORTIZ	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.277+00	2026-09-02 22:24:15.294+00
dbd63745-e037-438b-a665-88df5347b07c	900000071	ALEJANDRO	ZARACHO	\N	\N	\N	\N	2026-09-02	INACTIVE	2026-09-02 22:24:15.319+00	2026-09-02 22:24:15.344+00
\.


--
-- Data for Name: tariffs; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.tariffs (id, name, amount, valid_from, valid_to, status, created_at, updated_at, class_id) FROM stdin;
9c8c66d8-4e97-4603-903a-ba1d2832c23c	Histórica - Ladys Kizz - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:29.623+00	2026-10-01 20:19:01.687+00	06f93e1a-5cc0-4741-8ad6-813745ea389d
86ea823d-1082-45eb-b0d1-d722679d298d	Histórica - S.C Adultos (+18 años) - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:30.043+00	2026-10-01 20:19:01.736+00	71bc486f-8a3d-46bb-a102-838cfef0a1fc
f3d77d64-79df-40f5-bbe9-c7e1212bfa0e	Histórica - Ladys Kizz - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-10-01 20:19:01.815+00	2026-10-01 20:19:01.844+00	06f93e1a-5cc0-4741-8ad6-813745ea389d
aa882452-96fa-4ace-90e5-b43b424968cf	Histórica - Árabe infantil - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:28.328+00	2026-09-28 22:19:28.345+00	2b9ee038-bf48-4bb5-9315-c2015733d11c
e459a08c-97b0-4afb-8d9b-d9ff81c10f47	Histórica - Árabe infantil - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:28.358+00	2026-09-28 22:19:28.377+00	2b9ee038-bf48-4bb5-9315-c2015733d11c
5a80f542-151d-4047-85eb-2cfc9bcc3d9b	Histórica - Árabe infantil - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-09-28 22:19:28.405+00	2026-09-28 22:19:28.422+00	2b9ee038-bf48-4bb5-9315-c2015733d11c
7d5f0b87-464a-43f8-bea5-320bf5e1c0bd	Histórica - Árabe infantil - 2026 - $30.000	30000.00	2026-01-01	2026-07-31	INACTIVE	2026-09-28 22:19:28.435+00	2026-09-28 22:19:28.454+00	2b9ee038-bf48-4bb5-9315-c2015733d11c
a76f171c-377e-4573-99a9-b6fd588a7abb	Histórica - Árabe infantil - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:28.467+00	2026-09-28 22:19:28.486+00	2b9ee038-bf48-4bb5-9315-c2015733d11c
c4b4c25b-eb7e-433e-934b-0cca6781b4f8	Histórica - Bachata en Pareja - 2026 - $15.000	15000.00	2026-02-01	2026-02-28	INACTIVE	2026-09-28 22:19:28.498+00	2026-09-28 22:19:28.516+00	d06eb88b-a6e3-4cda-8bf9-5278455b3b7e
364a71bb-c8cb-4dcc-884a-b2932034e9f6	Histórica - Bachata Pasos Sueltos - 2026 - $30.000	30000.00	2026-02-01	2026-02-28	INACTIVE	2026-09-28 22:19:28.529+00	2026-09-28 22:19:28.548+00	8da07d2d-b252-4618-9370-34f8ca23e93e
e194c2af-4420-4b55-899f-a6b82592282d	Histórica - Bachata y Salsa Inicial - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:28.584+00	2026-09-28 22:19:28.608+00	acbbc26b-2a55-4952-97a0-92dc025024d2
3dbdd5a1-cfb4-4a23-8fa8-27cca7ee2d07	Histórica - Bachata y Salsa Inicial - 2025 - $10.000	10000.00	2025-03-01	2025-05-31	INACTIVE	2026-09-28 22:19:28.618+00	2026-09-28 22:19:28.639+00	acbbc26b-2a55-4952-97a0-92dc025024d2
b431c0e1-78da-44f4-9a39-d3ce59dfe35e	Histórica - Bachata y Salsa Inicial - 2025 - $20.000	20000.00	2025-06-01	2025-08-31	INACTIVE	2026-09-28 22:19:28.651+00	2026-09-28 22:19:28.67+00	acbbc26b-2a55-4952-97a0-92dc025024d2
5a111de4-98a3-4d13-a47e-ae36180b9fbf	Histórica - Bachata y Salsa Inicial - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-09-28 22:19:28.684+00	2026-09-28 22:19:28.701+00	acbbc26b-2a55-4952-97a0-92dc025024d2
c6af6f71-e559-40f1-a2fe-66f62fa7a565	Histórica - Bachata y Salsa Inicial - 2026 - $30.000	30000.00	2026-01-01	2026-07-31	INACTIVE	2026-09-28 22:19:28.714+00	2026-09-28 22:19:28.731+00	acbbc26b-2a55-4952-97a0-92dc025024d2
441a9a62-ed1f-4ee1-a897-d52018f67a09	Histórica - Bachata y Salsa Inicial - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:28.744+00	2026-09-28 22:19:28.763+00	acbbc26b-2a55-4952-97a0-92dc025024d2
9b0d1a7a-a562-4945-9999-dd4cbdccdfbc	Histórica - Belly Dance Alternativo - 2025 - $15.000	15000.00	2025-02-01	2025-03-31	INACTIVE	2026-09-28 22:19:28.775+00	2026-09-28 22:19:28.786+00	dbd5af21-ec55-4380-8ca1-d643a10d2003
5ff5584b-dd90-4a81-90b6-117e1f17a52a	Histórica - Clase femenino Sofi - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:28.806+00	2026-09-28 22:19:28.824+00	d0762bb4-c6ef-45d4-8414-5ae0f158831f
bb2fa800-9be7-4383-8484-562843342740	Histórica - Clase femenino Sofi - 2025 - $20.000	20000.00	2025-03-01	2025-09-30	INACTIVE	2026-09-28 22:19:28.837+00	2026-09-28 22:19:28.857+00	d0762bb4-c6ef-45d4-8414-5ae0f158831f
ae72f4d3-99d2-4ee2-bffd-07f7517e1dde	Histórica - Clase femenino Sofi - 2025 - $30.000	30000.00	2025-10-01	2025-10-31	INACTIVE	2026-09-28 22:19:28.867+00	2026-09-28 22:19:28.878+00	d0762bb4-c6ef-45d4-8414-5ae0f158831f
c637f5c3-8007-4f2c-b43b-7522c9fba43b	Histórica - Clase femenino Sofi - 2025 - $25.000	25000.00	2025-11-01	2026-02-28	INACTIVE	2026-09-28 22:19:28.9+00	2026-09-28 22:19:28.917+00	d0762bb4-c6ef-45d4-8414-5ae0f158831f
18ca852e-066f-4f53-9463-9543bd7bff6c	Histórica - Clase femenino Sofi - 2026 - $30.000	30000.00	2026-03-01	2026-07-31	INACTIVE	2026-09-28 22:19:28.93+00	2026-09-28 22:19:28.949+00	d0762bb4-c6ef-45d4-8414-5ae0f158831f
6f75e684-b414-4851-b628-d06b7a0d7492	Histórica - Clase femenino Sofi - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:28.96+00	2026-09-28 22:19:28.997+00	d0762bb4-c6ef-45d4-8414-5ae0f158831f
0456fb7e-484b-4973-986f-8a072570650e	Histórica - Clase LT - A.Frank - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:29.026+00	2026-09-28 22:19:29.041+00	4074b25f-622a-4423-ac82-9d0cf90e3666
72f79efb-bde5-47cb-a8b2-f17a3bf03cbd	Histórica - Clase LT - A.Frank - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:29.054+00	2026-09-28 22:19:29.072+00	4074b25f-622a-4423-ac82-9d0cf90e3666
676fde03-8873-4301-85ba-cc2a64126552	Histórica - Clase LT - A.Frank - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-09-28 22:19:29.085+00	2026-09-28 22:19:29.103+00	4074b25f-622a-4423-ac82-9d0cf90e3666
d3de6abe-8961-4ad9-b86b-b1fd6523013d	Histórica - Clase LT - A.Frank - 2026 - $30.000	30000.00	2026-01-01	2026-06-30	INACTIVE	2026-09-28 22:19:29.115+00	2026-09-28 22:19:29.134+00	4074b25f-622a-4423-ac82-9d0cf90e3666
ee08da83-5082-4bea-965c-add293d4095f	Histórica - Clase LT - A.Frank - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:29.146+00	2026-09-28 22:19:29.156+00	4074b25f-622a-4423-ac82-9d0cf90e3666
2fdefc77-2675-4091-b498-2595ba7a0ca2	Histórica - Coreográfico Bachata en Pareja - 2025 - $20.000	20000.00	2025-05-01	2025-05-31	INACTIVE	2026-09-28 22:19:29.177+00	2026-09-28 22:19:29.195+00	28f1b214-f935-4bea-8a8c-a28789592bb0
734edc8b-9709-46d2-a27f-653e4c6a70a0	Histórica - Coreográfico Bachata en Pareja - 2025 - $10.000	10000.00	2025-06-01	2025-06-30	INACTIVE	2026-09-28 22:19:29.207+00	2026-09-28 22:19:29.225+00	28f1b214-f935-4bea-8a8c-a28789592bb0
162ee729-b047-4333-a406-87ebf2a0f533	Histórica - Fitdance + Axé - 2025 - $7.500	7500.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:29.239+00	2026-09-28 22:19:29.258+00	db1e0e5e-c5e0-429e-aec3-4f28d406dad9
a16c3950-049b-4fbf-b176-df8327d06f53	Histórica - Grupo C. - A.Frank - 2026 - $25.000	25000.00	2026-03-01	2026-06-30	INACTIVE	2026-09-28 22:19:29.269+00	2026-09-28 22:19:29.287+00	e63b18a1-afc2-4fd1-aa80-dfce8909e30f
914435a3-afe2-4fe1-963b-11756a49460c	Histórica - Infantil (6 a 7 años) - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:29.298+00	2026-09-28 22:19:29.318+00	bcea570e-e3dd-499f-8a4b-88f079773871
123779f5-04b8-4ffa-abee-99e3847f4b73	Histórica - Infantil (6 a 7 años) - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:29.329+00	2026-09-28 22:19:29.349+00	bcea570e-e3dd-499f-8a4b-88f079773871
d72e610b-f97f-4f4b-bdac-0b3a2863bd7f	Histórica - Infantil (6 a 7 años) - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-09-28 22:19:29.36+00	2026-09-28 22:19:29.379+00	bcea570e-e3dd-499f-8a4b-88f079773871
fc032672-6b48-4c9a-ba6a-6bd89d550ca5	Histórica - Infantil (6 a 7 años) - 2026 - $30.000	30000.00	2026-01-01	2026-07-31	INACTIVE	2026-09-28 22:19:29.392+00	2026-09-28 22:19:29.41+00	bcea570e-e3dd-499f-8a4b-88f079773871
8da28256-cc8c-49fc-a870-aba43ee2c5e1	Histórica - Infantil (6 a 7 años) - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:29.422+00	2026-09-28 22:19:29.441+00	bcea570e-e3dd-499f-8a4b-88f079773871
103cced5-8bf6-482d-adcf-07ffbbc59b24	Histórica - Kids 4-5 años - 2025 - $20.000	20000.00	2025-05-01	2025-08-31	INACTIVE	2026-09-28 22:19:29.453+00	2026-09-28 22:19:29.473+00	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a
925932a4-0520-4015-8371-c3a9be054e08	Histórica - Kids 4-5 años - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-09-28 22:19:29.484+00	2026-09-28 22:19:29.504+00	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a
3327e836-9638-472d-aba1-041a3a9f4e0d	Histórica - Kids 4-5 años - 2026 - $30.000	30000.00	2026-01-01	2026-07-31	INACTIVE	2026-09-28 22:19:29.516+00	2026-09-28 22:19:29.535+00	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a
d486fbe3-9556-4719-9bdd-df68bd63118d	Histórica - Kids 4-5 años - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:29.563+00	2026-09-28 22:19:29.58+00	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a
587baadd-638d-4787-8f10-e0f43c6d7881	Histórica - Ladys Kizz - 2025 - $7.500	7500.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:29.592+00	2026-09-28 22:19:29.604+00	06f93e1a-5cc0-4741-8ad6-813745ea389d
a69183c3-9be5-438e-9a58-1051ecfc6583	Histórica - Ladys Tango - Gabriela P. - 2025 - $7.500	7500.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:29.671+00	2026-09-28 22:19:29.688+00	a12f5acf-4754-479a-853c-15926c2dac92
0fb22db6-e054-4fce-b307-d358d6dda3de	Histórica - Ladys Tango - Gabriela P. - 2025 - $10.000	10000.00	2025-03-01	2025-04-30	INACTIVE	2026-09-28 22:19:29.715+00	2026-09-28 22:19:29.732+00	a12f5acf-4754-479a-853c-15926c2dac92
bf30c76e-1c76-4865-a2f8-6dfca3c8c8eb	Histórica - Ladys Tango - Gabriela P. - 2025 - $11.000	11000.00	2025-05-01	2025-06-30	INACTIVE	2026-09-28 22:19:29.745+00	2026-09-28 22:19:29.765+00	a12f5acf-4754-479a-853c-15926c2dac92
1cc0b2c3-cd83-432b-a4a5-d7008819c3c6	Histórica - Ladys Tango - Gabriela P. - 2025 - $20.000	20000.00	2025-07-01	2025-07-31	INACTIVE	2026-09-28 22:19:29.778+00	2026-09-28 22:19:29.796+00	a12f5acf-4754-479a-853c-15926c2dac92
cba38891-1127-43ad-9dcc-7b8d2581d1c8	Histórica - Mambo en parejas - 2026 - $15.000	15000.00	2026-02-01	2026-02-28	INACTIVE	2026-09-28 22:19:29.809+00	2026-09-28 22:19:29.828+00	b96017bd-9ee1-4bde-ad35-ad961a78e5f5
41fc1130-31df-4b19-94ae-8a83cc28cae7	Histórica - Mambo en parejas - 2026 - $30.000	30000.00	2026-03-01	2026-07-31	INACTIVE	2026-09-28 22:19:29.857+00	2026-09-28 22:19:29.875+00	b96017bd-9ee1-4bde-ad35-ad961a78e5f5
a191574a-3c02-40e3-927e-41be6b018d55	Histórica - Mambo en parejas - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:29.903+00	2026-09-28 22:19:29.92+00	b96017bd-9ee1-4bde-ad35-ad961a78e5f5
a5717945-007a-44b1-bdf4-686869052f4b	Histórica - Ritmos latinos y caribeños - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:29.934+00	2026-09-28 22:19:29.954+00	1a8e1c0e-1f96-4de2-a33d-c932e74f2314
a65d4710-3bcb-4e8c-aef4-a051fad1608a	Histórica - Ritmos latinos y caribeños - 2025 - $20.000	20000.00	2025-03-01	2025-07-31	INACTIVE	2026-09-28 22:19:29.966+00	2026-09-28 22:19:29.985+00	1a8e1c0e-1f96-4de2-a33d-c932e74f2314
ed097626-3640-44b4-adc4-ac27eec79aee	Histórica - S.C Adultos (+18 años) - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:30.013+00	2026-09-28 22:19:30.03+00	71bc486f-8a3d-46bb-a102-838cfef0a1fc
22c0d8ba-2879-435c-8458-2ca064af6c80	Histórica - S.C Infantil (6-11 años) - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:30.074+00	2026-09-28 22:19:30.093+00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff
796a2823-cc0c-4b39-acd8-eb381b088209	Histórica - S.C Infantil (6-11 años) - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:30.104+00	2026-10-01 20:19:01.752+00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff
3779694f-c15e-4e36-b381-d91f46f32549	Histórica - S.C Juvenil (12-17 años) - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:30.166+00	2026-10-01 20:19:01.782+00	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3
ac03ca64-6890-458f-bb88-4e14644cf5d2	Histórica - S.C Juvenil (12-17 años) - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:30.136+00	2026-09-28 22:19:30.154+00	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3
22574083-c342-4af1-b475-ff40a4193088	Histórica - Street Int/Avanzado - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:30.228+00	2026-10-01 20:19:01.802+00	dd4b0323-e82f-4b02-89c0-0f8e520033ed
b2f1e2ca-0630-4bab-a01c-a6bf43949a6d	Histórica - Street Int/Avanzado - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:30.197+00	2026-09-28 22:19:30.217+00	dd4b0323-e82f-4b02-89c0-0f8e520033ed
7bf87090-6f79-41eb-a46a-9ced068c5759	Histórica - Ladys Kizz - 2026 - $30.000	30000.00	2026-01-01	2026-06-30	INACTIVE	2026-10-01 20:19:01.872+00	2026-10-01 20:19:01.883+00	06f93e1a-5cc0-4741-8ad6-813745ea389d
3b329983-c407-46e5-8f5a-8e112688ca7a	Histórica - Tango (Inter/Avanz) - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:30.261+00	2026-09-28 22:19:30.278+00	cc392129-75e3-4205-b7fc-fafceb55b996
14bf708d-20b2-4868-b09e-2103f21d9130	Histórica - Ladys Kizz - 2026 - $15.000	15000.00	2026-07-01	2026-07-31	INACTIVE	2026-10-01 20:19:01.904+00	2026-10-01 20:19:01.921+00	06f93e1a-5cc0-4741-8ad6-813745ea389d
bd91d623-5a66-45f6-9763-3bcc67dc6ab8	Histórica - Tango (Inter/Avanz) - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:30.291+00	2026-09-28 22:19:30.31+00	cc392129-75e3-4205-b7fc-fafceb55b996
b30eecb7-73ea-46df-8979-9d599a6db2d7	Histórica - Tango (Inter/Avanz) - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-09-28 22:19:30.322+00	2026-09-28 22:19:30.341+00	cc392129-75e3-4205-b7fc-fafceb55b996
a7a80252-57de-41a6-9c22-e9c4da979600	Histórica - Ladys Kizz - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-10-01 20:19:01.934+00	2026-10-01 20:19:01.953+00	06f93e1a-5cc0-4741-8ad6-813745ea389d
86843bf5-f1d7-4175-bb8d-f97019dc8a4c	Histórica - Tango (Inter/Avanz) - 2026 - $30.000	30000.00	2026-03-01	2026-07-31	INACTIVE	2026-09-28 22:19:30.351+00	2026-09-28 22:19:30.372+00	cc392129-75e3-4205-b7fc-fafceb55b996
52a9429d-f4ca-45cb-b754-2c1fc35ff6ed	Histórica - Tango (Inter/Avanz) - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:30.384+00	2026-09-28 22:19:30.404+00	cc392129-75e3-4205-b7fc-fafceb55b996
f60f5345-4d4c-446c-a52d-ac9b24884bde	Histórica - S.C Adultos (+18 años) - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-10-01 20:19:01.966+00	2026-10-01 20:19:01.987+00	71bc486f-8a3d-46bb-a102-838cfef0a1fc
6994486c-c6c5-4256-b4d1-2c6af462fe0d	Histórica - Tango Inicial - 2026 - $30.000	30000.00	2026-03-01	2026-03-31	INACTIVE	2026-09-28 22:19:30.433+00	2026-09-28 22:19:30.45+00	23888530-c53d-4c40-94ee-982518e5d2f6
d30c4d7f-5861-468f-a593-61509fb932db	Histórica - Teens (8 a 12 años) - 2025 - $15.000	15000.00	2025-02-01	2025-02-28	INACTIVE	2026-09-28 22:19:30.462+00	2026-09-28 22:19:30.481+00	da4d15d9-c846-4098-8640-e95fd97c604f
0d10e405-d5a7-4a0e-b739-6c1487222fb5	Histórica - S.C Adultos (+18 años) - 2026 - $30.000	30000.00	2026-01-01	2026-06-30	INACTIVE	2026-10-01 20:19:02.013+00	2026-10-01 20:19:02.031+00	71bc486f-8a3d-46bb-a102-838cfef0a1fc
02f381ef-414d-4e75-9b9e-b657c693b7d9	Histórica - Teens (8 a 12 años) - 2025 - $20.000	20000.00	2025-03-01	2025-08-31	INACTIVE	2026-09-28 22:19:30.493+00	2026-09-28 22:19:30.513+00	da4d15d9-c846-4098-8640-e95fd97c604f
0cf97597-0cc8-4424-83f9-09112cbb0a39	Histórica - Teens (8 a 12 años) - 2025 - $30.000	30000.00	2025-09-01	2025-10-31	INACTIVE	2026-09-28 22:19:30.524+00	2026-09-28 22:19:30.541+00	da4d15d9-c846-4098-8640-e95fd97c604f
d147d7ff-7103-4e02-bfa0-3d680a515107	Histórica - S.C Adultos (+18 años) - 2026 - $15.000	15000.00	2026-07-01	2026-07-31	INACTIVE	2026-10-01 20:19:02.04+00	2026-10-01 20:19:02.063+00	71bc486f-8a3d-46bb-a102-838cfef0a1fc
86ee3fcb-eb94-4d7d-a0d0-0e82c5b96081	Histórica - Teens (8 a 12 años) - 2025 - $25.000	25000.00	2025-11-01	2025-11-30	INACTIVE	2026-09-28 22:19:30.555+00	2026-09-28 22:19:30.572+00	da4d15d9-c846-4098-8640-e95fd97c604f
641bfe45-cdae-4050-a4d3-09cf6c5dcfd9	Histórica - Teens (8 a 12 años) - 2026 - $30.000	30000.00	2026-01-01	2026-01-31	INACTIVE	2026-09-28 22:19:30.586+00	2026-09-28 22:19:30.604+00	da4d15d9-c846-4098-8640-e95fd97c604f
e2f40f29-6daa-4756-8edf-af82fbb35730	Histórica - S.C Adultos (+18 años) - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-10-01 20:19:02.094+00	2026-10-01 20:19:02.111+00	71bc486f-8a3d-46bb-a102-838cfef0a1fc
bbe14afa-6e91-48c7-9108-768e253b5656	Histórica - Teens (8 a 12 años) - 2026 - $15.000	15000.00	2026-02-01	2026-02-28	INACTIVE	2026-09-28 22:19:30.618+00	2026-09-28 22:19:30.636+00	da4d15d9-c846-4098-8640-e95fd97c604f
4a619e92-8a47-481c-ba44-3934c97c41d7	Histórica - Teens (8 a 12 años) - 2026 - $30.000	30000.00	2026-03-01	2026-07-31	INACTIVE	2026-09-28 22:19:30.648+00	2026-09-28 22:19:30.666+00	da4d15d9-c846-4098-8640-e95fd97c604f
f2089824-1e87-48e8-a86d-fa7d9d8bb294	Histórica - S.C Infantil (6-11 años) - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-10-01 20:19:02.124+00	2026-10-01 20:19:02.142+00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff
24b8d991-5d15-429e-8621-45dc871f50fd	Histórica - Teens (8 a 12 años) - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:30.679+00	2026-09-28 22:19:30.698+00	da4d15d9-c846-4098-8640-e95fd97c604f
89824a1f-9817-4e7e-9ccb-dec4cacaf971	Histórica - Zumba - Profe Joselo - 2026 - $30.000	30000.00	2026-05-01	2026-07-31	INACTIVE	2026-09-28 22:19:30.71+00	2026-09-28 22:19:30.727+00	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b
54466e23-901a-474c-b308-1005e6c2e4a1	Histórica - S.C Infantil (6-11 años) - 2026 - $30.000	30000.00	2026-01-01	2026-06-30	INACTIVE	2026-10-01 20:19:02.152+00	2026-10-01 20:19:02.174+00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff
aa569d36-d055-4f83-98c2-04ae62aa9605	Histórica - Zumba - Profe Joselo - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-09-28 22:19:30.741+00	2026-09-28 22:19:30.76+00	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b
4821b330-fd0c-465b-aac1-e455c25eafef	Histórica - S.C Infantil (6-11 años) - 2026 - $15.000	15000.00	2026-07-01	2026-07-31	INACTIVE	2026-10-01 20:19:02.201+00	2026-10-01 20:19:02.218+00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff
fc32f429-9816-4dd8-b6c6-52dfc093666f	Histórica - S.C Infantil (6-11 años) - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-10-01 20:19:02.231+00	2026-10-01 20:19:02.25+00	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff
7fe71911-f958-40cf-bc93-af63df84e5af	Histórica - S.C Juvenil (12-17 años) - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-10-01 20:19:02.278+00	2026-10-01 20:19:02.298+00	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3
bc4b4bb2-b26e-498b-96a9-2439361bc017	Histórica - S.C Juvenil (12-17 años) - 2026 - $30.000	30000.00	2026-01-01	2026-06-30	INACTIVE	2026-10-01 20:19:02.324+00	2026-10-01 20:19:02.343+00	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3
61ba6810-4779-4628-9a55-85bcbe50a85b	Histórica - S.C Juvenil (12-17 años) - 2026 - $15.000	15000.00	2026-07-01	2026-07-31	INACTIVE	2026-10-01 20:19:02.369+00	2026-10-01 20:19:02.387+00	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3
d3762c37-63b7-460f-be9f-d8df59f8593c	Histórica - S.C Juvenil (12-17 años) - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-10-01 20:19:02.4+00	2026-10-01 20:19:02.418+00	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3
9a5652e7-1099-4915-ba71-739135ec556c	Histórica - Street Int/Avanzado - 2025 - $30.000	30000.00	2025-09-01	2025-11-30	INACTIVE	2026-10-01 20:19:02.432+00	2026-10-01 20:19:02.442+00	dd4b0323-e82f-4b02-89c0-0f8e520033ed
9444740f-d590-4310-a9e6-afff4f301224	Histórica - Street Int/Avanzado - 2026 - $30.000	30000.00	2026-01-01	2026-06-30	INACTIVE	2026-10-01 20:19:02.464+00	2026-10-01 20:19:02.482+00	dd4b0323-e82f-4b02-89c0-0f8e520033ed
2d651fdc-1dca-400f-8dab-efe75ef29ade	Histórica - Street Int/Avanzado - 2026 - $15.000	15000.00	2026-07-01	2026-07-31	INACTIVE	2026-10-01 20:19:02.494+00	2026-10-01 20:19:02.512+00	dd4b0323-e82f-4b02-89c0-0f8e520033ed
5614c71c-e002-4142-b512-036adedb77ed	Histórica - Street Int/Avanzado - 2026 - $40.000	40000.00	2026-08-01	2026-08-31	INACTIVE	2026-10-01 20:19:02.525+00	2026-10-01 20:19:02.545+00	dd4b0323-e82f-4b02-89c0-0f8e520033ed
\.


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.teachers (id, dni, first_name, last_name, phone, email, address, status, created_at, updated_at) FROM stdin;
84f401a3-d810-40cb-b456-ac77c7c2dbcc	44464646	carlos	sanchez	329329329	carlosanches@elsrkj.com	lalong	INACTIVE	2026-08-21 23:38:33.422+00	2026-08-23 20:04:09.414+00
79685a44-f200-473c-9185-4c45b97e7441	26042283	Roberto Carlos	Dominguez	5493704556570	robertodomingueztango@gmail.com	B° San martín, calle Belgrano 1149	ACTIVE	2026-08-23 20:10:06.321+00	2026-08-28 21:48:20.503+00
38bfbac8-b451-4e00-ae80-9317a6628c17	34842644	Gabriela Gisel	Pereira	00000000	gabrielagiselpereira@gmail.com	B° San Martin, calle Belgrano 1149	ACTIVE	2026-08-28 21:49:12.541+00	2026-08-28 21:49:12.541+00
6c9ec6fe-f95e-4b83-bda4-05fa91d24cb4	93285358	María Lucía	Herebia	-	luciaherebia09@gmail.com	Mz 42 Casa 22 B° Illia II	ACTIVE	2026-08-28 21:53:18.901+00	2026-08-28 21:53:18.901+00
297cc413-faec-4274-8de1-272f32231fa5	35897801	Maria Virginia	Henquin	5493704232258	hqzukeemv@gmail.com	Miguel Ovejero 162	ACTIVE	2026-08-23 20:10:48.826+00	2026-08-28 21:54:50.746+00
fcfd33ff-d0be-43bc-8440-1fb444c4eb33	30678907	Jose Luis	Barrios	5493704560245	bahianojoseluis@gmail.com	Barrio 20 de julio mz 46 casa 6	ACTIVE	2026-08-23 20:09:43.519+00	2026-08-28 21:55:18.616+00
5e3dfae4-8670-4dfa-a351-d889551ab3e7	38191208	Sofia	Aracelli Puchini	5493704902790	sofiapuchini@hotmail.com	b Evita mz 114 casa 10	ACTIVE	2026-08-23 20:09:08.882+00	2026-08-28 21:55:35.838+00
9ace89e8-ca8d-4069-b972-6af360ee834f	43807585	Magalí Abigail	Oviedo	-	maguioviedo2@gmail.com	B° San Agustín, Parkinson 575	ACTIVE	2026-08-28 21:56:10.115+00	2026-08-28 21:56:10.115+00
e6fe9713-5f07-4a67-8613-4ddb0e936efa	38577007	Anabella	Frank	5493705041551	anabella010595@gmail.com	B° Don Bosco, Fortín Yunká 1145	ACTIVE	2026-08-23 20:08:13.711+00	2026-08-28 21:56:45.356+00
38514755-4686-4ca3-88c9-11d68985cdd6	34597226	Fabiana Andrea	Arias	5493704278801	fabianaandreaarias9@gmail.com	B.Procrear MZ 128 C11	ACTIVE	2026-08-23 20:11:17.285+00	2026-08-28 21:57:00.945+00
a289ca41-3d4d-402a-9e50-68801ed393c2	42425599	Santiago	Reyes	5493705036093	Reyessantiagoariel@gmail.com	B° República Argentina, mz 78 casa 8	ACTIVE	2026-08-23 20:07:45.35+00	2026-08-28 21:57:27.558+00
d38d5749-cf17-49ab-a9f9-af4078408cdc	36956550	Fernando	Ibañez	3704080868	fernando.ibz13@gmail.com	Julio Argentino Roca 310	ACTIVE	2026-08-23 20:12:31.306+00	2026-08-28 21:57:53.614+00
120f8965-3888-4b64-ba9a-d3ed4da7ed39	39719376	Kevin	De los Santos	5493705016997	-@hotmail.com	Sin dato	INACTIVE	2026-08-23 20:12:15.736+00	2026-08-28 21:58:13.09+00
c928b5d7-a2bf-4613-8103-a551a6d10f9e	41270400	Marcos Antonio	Lopez	5493704594737	-@hotmail.com	Saavedra y primera	INACTIVE	2026-08-23 20:11:59.141+00	2026-08-28 21:58:35.528+00
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: cash_movements cash_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id);


--
-- Name: cash_reconciliation_corrections cash_reconciliation_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_reconciliation_corrections
    ADD CONSTRAINT cash_reconciliation_corrections_pkey PRIMARY KEY (id);


--
-- Name: cash_shift_closing_lines cash_shift_closing_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_shift_closing_lines
    ADD CONSTRAINT cash_shift_closing_lines_pkey PRIMARY KEY (id);


--
-- Name: cash_shifts cash_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_shifts
    ADD CONSTRAINT cash_shifts_pkey PRIMARY KEY (id);


--
-- Name: class_schedules class_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: dance_types dance_types_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.dance_types
    ADD CONSTRAINT dance_types_pkey PRIMARY KEY (id);


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_pkey PRIMARY KEY (id);


--
-- Name: monthly_charges monthly_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charges
    ADD CONSTRAINT monthly_charges_pkey PRIMARY KEY (id);


--
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: payment_tenders payment_tenders_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payment_tenders
    ADD CONSTRAINT payment_tenders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: student_attendances student_attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.student_attendances
    ADD CONSTRAINT student_attendances_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: tariffs tariffs_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.tariffs
    ADD CONSTRAINT tariffs_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX admin_sessions_expires_at_idx ON public.admin_sessions USING btree (expires_at);


--
-- Name: admin_sessions_token_hash_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX admin_sessions_token_hash_key ON public.admin_sessions USING btree (token_hash);


--
-- Name: admin_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX admin_sessions_user_id_idx ON public.admin_sessions USING btree (user_id);


--
-- Name: admin_users_username_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX admin_users_username_key ON public.admin_users USING btree (username);


--
-- Name: audit_logs_action_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX audit_logs_action_created_at_idx ON public.audit_logs USING btree (action, created_at DESC);


--
-- Name: audit_logs_actor_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX audit_logs_actor_user_id_created_at_idx ON public.audit_logs USING btree (actor_user_id, created_at DESC);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_entity_type_entity_id_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX audit_logs_entity_type_entity_id_created_at_idx ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: branches_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX branches_name_idx ON public.branches USING btree (name);


--
-- Name: cash_movements_cash_shift_id_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX cash_movements_cash_shift_id_created_at_idx ON public.cash_movements USING btree (cash_shift_id, created_at);


--
-- Name: cash_movements_collection_tender_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX cash_movements_collection_tender_key ON public.cash_movements USING btree (source_payment_tender_id) WHERE (type = 'COLLECTION'::public."CashMovementType");


--
-- Name: cash_movements_reversal_of_id_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX cash_movements_reversal_of_id_key ON public.cash_movements USING btree (reversal_of_id);


--
-- Name: cash_movements_source_payment_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX cash_movements_source_payment_id_idx ON public.cash_movements USING btree (source_payment_id);


--
-- Name: cash_movements_source_payment_tender_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX cash_movements_source_payment_tender_id_idx ON public.cash_movements USING btree (source_payment_tender_id);


--
-- Name: cash_reconciliation_corrections_cash_shift_id_method_create_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX cash_reconciliation_corrections_cash_shift_id_method_create_idx ON public.cash_reconciliation_corrections USING btree (cash_shift_id, method, created_at);


--
-- Name: cash_shift_closing_lines_cash_shift_id_method_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX cash_shift_closing_lines_cash_shift_id_method_key ON public.cash_shift_closing_lines USING btree (cash_shift_id, method);


--
-- Name: cash_shifts_one_open_per_user_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX cash_shifts_one_open_per_user_key ON public.cash_shifts USING btree (user_id) WHERE (status = 'OPEN'::public."CashShiftStatus");


--
-- Name: cash_shifts_status_opened_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX cash_shifts_status_opened_at_idx ON public.cash_shifts USING btree (status, opened_at DESC);


--
-- Name: cash_shifts_user_id_opened_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX cash_shifts_user_id_opened_at_idx ON public.cash_shifts USING btree (user_id, opened_at DESC);


--
-- Name: class_schedules_class_id_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX class_schedules_class_id_status_idx ON public.class_schedules USING btree (class_id, status);


--
-- Name: class_schedules_room_id_day_of_week_status_start_time_end_t_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX class_schedules_room_id_day_of_week_status_start_time_end_t_idx ON public.class_schedules USING btree (room_id, day_of_week, status, start_time, end_time);


--
-- Name: classes_dance_type_id_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX classes_dance_type_id_status_idx ON public.classes USING btree (dance_type_id, status);


--
-- Name: classes_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX classes_name_idx ON public.classes USING btree (name);


--
-- Name: classes_teacher_id_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX classes_teacher_id_status_idx ON public.classes USING btree (teacher_id, status);


--
-- Name: dance_types_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX dance_types_name_idx ON public.dance_types USING btree (name);


--
-- Name: dance_types_normalized_name_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX dance_types_normalized_name_key ON public.dance_types USING btree (normalized_name);


--
-- Name: enrollment_billing_conditions_enrollment_id_effective_from__idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX enrollment_billing_conditions_enrollment_id_effective_from__idx ON public.enrollment_billing_conditions USING btree (enrollment_id, effective_from, effective_until);


--
-- Name: enrollment_billing_conditions_teacher_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX enrollment_billing_conditions_teacher_id_idx ON public.enrollment_billing_conditions USING btree (teacher_id);


--
-- Name: enrollments_active_student_class_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX enrollments_active_student_class_key ON public.enrollments USING btree (student_id, class_id) WHERE (status = 'ACTIVE'::public."EnrollmentStatus");


--
-- Name: enrollments_class_id_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX enrollments_class_id_status_idx ON public.enrollments USING btree (class_id, status);


--
-- Name: enrollments_student_id_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX enrollments_student_id_status_idx ON public.enrollments USING btree (student_id, status);


--
-- Name: leads_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_name_idx ON public.leads USING btree (name);


--
-- Name: leads_next_follow_up_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_next_follow_up_at_idx ON public.leads USING btree (next_follow_up_at);


--
-- Name: leads_normalized_email_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_normalized_email_idx ON public.leads USING btree (normalized_email);


--
-- Name: leads_normalized_instagram_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_normalized_instagram_idx ON public.leads USING btree (normalized_instagram);


--
-- Name: leads_normalized_phone_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_normalized_phone_idx ON public.leads USING btree (normalized_phone);


--
-- Name: leads_source_updated_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_source_updated_at_idx ON public.leads USING btree (source, updated_at DESC);


--
-- Name: leads_status_updated_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX leads_status_updated_at_idx ON public.leads USING btree (status, updated_at DESC);


--
-- Name: monthly_charge_adjustments_monthly_charge_id_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX monthly_charge_adjustments_monthly_charge_id_created_at_idx ON public.monthly_charge_adjustments USING btree (monthly_charge_id, created_at);


--
-- Name: monthly_charge_adjustments_monthly_charge_id_source_conditi_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX monthly_charge_adjustments_monthly_charge_id_source_conditi_key ON public.monthly_charge_adjustments USING btree (monthly_charge_id, source_condition_id);


--
-- Name: monthly_charge_adjustments_one_late_fee_per_charge; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX monthly_charge_adjustments_one_late_fee_per_charge ON public.monthly_charge_adjustments USING btree (monthly_charge_id) WHERE (type = 'LATE_FEE'::public."BillingAdjustmentType");


--
-- Name: monthly_charge_adjustments_reversal_of_id_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX monthly_charge_adjustments_reversal_of_id_key ON public.monthly_charge_adjustments USING btree (reversal_of_id);


--
-- Name: monthly_charge_adjustments_teacher_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX monthly_charge_adjustments_teacher_id_idx ON public.monthly_charge_adjustments USING btree (teacher_id);


--
-- Name: monthly_charges_enrollment_id_period_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX monthly_charges_enrollment_id_period_key ON public.monthly_charges USING btree (enrollment_id, period);


--
-- Name: monthly_charges_enrollment_id_period_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX monthly_charges_enrollment_id_period_status_idx ON public.monthly_charges USING btree (enrollment_id, period, status);


--
-- Name: monthly_charges_period_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX monthly_charges_period_status_idx ON public.monthly_charges USING btree (period, status);


--
-- Name: monthly_charges_student_id_period_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX monthly_charges_student_id_period_status_idx ON public.monthly_charges USING btree (student_id, period, status);


--
-- Name: monthly_charges_tariff_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX monthly_charges_tariff_id_idx ON public.monthly_charges USING btree (tariff_id);


--
-- Name: payment_allocations_monthly_charge_id_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX payment_allocations_monthly_charge_id_idx ON public.payment_allocations USING btree (monthly_charge_id);


--
-- Name: payment_allocations_payment_id_monthly_charge_id_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX payment_allocations_payment_id_monthly_charge_id_key ON public.payment_allocations USING btree (payment_id, monthly_charge_id);


--
-- Name: payment_tenders_method_created_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX payment_tenders_method_created_at_idx ON public.payment_tenders USING btree (method, created_at);


--
-- Name: payment_tenders_payment_id_method_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX payment_tenders_payment_id_method_key ON public.payment_tenders USING btree (payment_id, method);


--
-- Name: payments_status_paid_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX payments_status_paid_at_idx ON public.payments USING btree (status, paid_at);


--
-- Name: payments_student_id_paid_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX payments_student_id_paid_at_idx ON public.payments USING btree (student_id, paid_at);


--
-- Name: rooms_branch_id_status_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX rooms_branch_id_status_idx ON public.rooms USING btree (branch_id, status);


--
-- Name: rooms_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX rooms_name_idx ON public.rooms USING btree (name);


--
-- Name: student_attendances_attendance_date_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX student_attendances_attendance_date_idx ON public.student_attendances USING btree (attendance_date);


--
-- Name: student_attendances_enrollment_id_attendance_date_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX student_attendances_enrollment_id_attendance_date_key ON public.student_attendances USING btree (enrollment_id, attendance_date);


--
-- Name: students_dni_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX students_dni_key ON public.students USING btree (dni);


--
-- Name: students_last_name_first_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX students_last_name_first_name_idx ON public.students USING btree (last_name, first_name);


--
-- Name: tariffs_class_id_valid_from_valid_to_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX tariffs_class_id_valid_from_valid_to_idx ON public.tariffs USING btree (class_id, valid_from, valid_to);


--
-- Name: tariffs_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX tariffs_name_idx ON public.tariffs USING btree (name);


--
-- Name: tariffs_status_valid_from_valid_to_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX tariffs_status_valid_from_valid_to_idx ON public.tariffs USING btree (status, valid_from, valid_to);


--
-- Name: teachers_dni_key; Type: INDEX; Schema: public; Owner: academy
--

CREATE UNIQUE INDEX teachers_dni_key ON public.teachers USING btree (dni);


--
-- Name: teachers_last_name_first_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX teachers_last_name_first_name_idx ON public.teachers USING btree (last_name, first_name);


--
-- Name: admin_sessions admin_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_movements cash_movements_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_movements cash_movements_cash_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_cash_shift_id_fkey FOREIGN KEY (cash_shift_id) REFERENCES public.cash_shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_movements cash_movements_reversal_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_reversal_of_id_fkey FOREIGN KEY (reversal_of_id) REFERENCES public.cash_movements(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_movements cash_movements_source_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_source_payment_id_fkey FOREIGN KEY (source_payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_movements cash_movements_source_payment_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_source_payment_tender_id_fkey FOREIGN KEY (source_payment_tender_id) REFERENCES public.payment_tenders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_reconciliation_corrections cash_reconciliation_corrections_cash_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_reconciliation_corrections
    ADD CONSTRAINT cash_reconciliation_corrections_cash_shift_id_fkey FOREIGN KEY (cash_shift_id) REFERENCES public.cash_shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_reconciliation_corrections cash_reconciliation_corrections_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_reconciliation_corrections
    ADD CONSTRAINT cash_reconciliation_corrections_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_shift_closing_lines cash_shift_closing_lines_cash_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_shift_closing_lines
    ADD CONSTRAINT cash_shift_closing_lines_cash_shift_id_fkey FOREIGN KEY (cash_shift_id) REFERENCES public.cash_shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_shifts cash_shifts_closed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_shifts
    ADD CONSTRAINT cash_shifts_closed_by_user_id_fkey FOREIGN KEY (closed_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_shifts cash_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.cash_shifts
    ADD CONSTRAINT cash_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: class_schedules class_schedules_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: class_schedules class_schedules_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: classes classes_dance_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_dance_type_id_fkey FOREIGN KEY (dance_type_id) REFERENCES public.dance_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_authorized_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_authorized_by_user_id_fkey FOREIGN KEY (authorized_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_ended_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_ended_by_user_id_fkey FOREIGN KEY (ended_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_renewed_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_renewed_from_id_fkey FOREIGN KEY (renewed_from_id) REFERENCES public.enrollment_billing_conditions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollment_billing_conditions enrollment_billing_conditions_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollment_billing_conditions
    ADD CONSTRAINT enrollment_billing_conditions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollments enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_authorized_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_authorized_by_user_id_fkey FOREIGN KEY (authorized_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_monthly_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_monthly_charge_id_fkey FOREIGN KEY (monthly_charge_id) REFERENCES public.monthly_charges(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_reversal_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_reversal_of_id_fkey FOREIGN KEY (reversal_of_id) REFERENCES public.monthly_charge_adjustments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_source_condition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_source_condition_id_fkey FOREIGN KEY (source_condition_id) REFERENCES public.enrollment_billing_conditions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charge_adjustments monthly_charge_adjustments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charge_adjustments
    ADD CONSTRAINT monthly_charge_adjustments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charges monthly_charges_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charges
    ADD CONSTRAINT monthly_charges_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charges monthly_charges_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charges
    ADD CONSTRAINT monthly_charges_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_charges monthly_charges_tariff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.monthly_charges
    ADD CONSTRAINT monthly_charges_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.tariffs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_allocations payment_allocations_monthly_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_monthly_charge_id_fkey FOREIGN KEY (monthly_charge_id) REFERENCES public.monthly_charges(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_allocations payment_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_tenders payment_tenders_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payment_tenders
    ADD CONSTRAINT payment_tenders_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_voided_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_voided_by_user_id_fkey FOREIGN KEY (voided_by_user_id) REFERENCES public.admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rooms rooms_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: student_attendances student_attendances_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.student_attendances
    ADD CONSTRAINT student_attendances_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tariffs tariffs_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.tariffs
    ADD CONSTRAINT tariffs_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict cpgUnZ6pCwc6nlsOZ3WQfbdYwwNgwZ0bz73eQy6QL9qP0TNY6HTozZRITtg4gCm

