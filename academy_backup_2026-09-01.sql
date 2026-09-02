--
-- PostgreSQL database dump
--

\restrict PBM6vMZFEdyFGbuCcA8g2lJruWbaSV7HD2aOdSFYioxv1qhEjyArEhP3FkhKly2

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
-- Name: MonthlyChargeStatus; Type: TYPE; Schema: public; Owner: academy
--

CREATE TYPE public."MonthlyChargeStatus" AS ENUM (
    'PENDING',
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
-- Name: payments; Type: TABLE; Schema: public; Owner: academy
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    student_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method public."PaymentMethod" NOT NULL,
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
14d14581-b36c-40c3-9d73-e69ed6ce5ea6	a1b7f3e42d573217b5c38af36177e2cd4bd14c2c817f6d6f76bca7f9bd3801c1	2026-08-20 23:37:44.008003+00	20260820190000_admin_authentication	\N	\N	2026-08-20 23:37:43.949181+00	1
476450a4-7f49-460d-8750-ed57344455e7	d8cd9d45c3dc0748202ce38dd4a17ac131e236db8c8204251730dfd053f91ebc	2026-08-20 23:37:44.19424+00	20260820200000_academic_offering_v1	\N	\N	2026-08-20 23:37:44.013163+00	1
7933621a-30b8-4de2-bc7b-1eda3b54781f	bcd3429e249e00c769b9fd9a15102021bcb1da22f922dbdaeab8becc3d8d33eb	2026-08-20 23:37:44.254078+00	20260820213000_enrollments_v1	\N	\N	2026-08-20 23:37:44.199047+00	1
fdee3e38-913f-41ca-8f3c-b964b9f44440	ed8d705afd87717340948ff46e3da735c0c1b902dd56d3a5424a105b62dbeac3	2026-08-20 23:37:44.363837+00	20260820230000_tariffs_monthly_charges_v1	\N	\N	2026-08-20 23:37:44.259036+00	1
311f85d2-1e17-4881-868a-d70d56e3fbf3	ce6153e325a2db4eeb2a0f9d94105a723df7ddb30fa029287992d7ccebc7ec18	2026-08-20 23:37:54.955741+00	20260820233754_migration1	\N	\N	2026-08-20 23:37:54.938328+00	1
d09aa298-f34b-48e9-94b2-f7551d8e199f	08a465e5cccd953f80ad3d1d287b41a3efbb25777048b2bf98fb39215072281f	2026-08-21 22:28:21.188204+00	20260821222821_add_student_attendances	\N	\N	2026-08-21 22:28:21.115993+00	1
4c686ebc-1e6d-447e-b4e6-c69409c205d7	b2845a1a20942e294c9eb6e49cdc773da008f37d5397a0a01ea17ca55459a853	2026-08-28 21:33:14.675011+00	20260827090000_attendance_timestamps_timestamptz	\N	\N	2026-08-28 21:33:14.60754+00	1
a3575b19-a724-4763-9a89-c1d9d6a5267c	df2ccaf9ef2818ee2fc57fe905a7246c8e0a87d9bae965477268bcd266762ca0	2026-08-28 21:33:14.774978+00	20260828120000_payments_v1	\N	\N	2026-08-28 21:33:14.680433+00	1
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
8ead25d1-a5f9-4670-a743-f0881f721511	6e1524a08b8789db001b9aefdbce102734d0eba1779082bf3c0c3e26576f60d1	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-02 09:28:53.562+00	2026-09-01 21:28:53.563+00
04c64816-cbe5-4edd-b48f-ff23c1ddf6a9	558b6aa5a4164ff56d3194c19cb18df9b9c79d4c8128c420acce2b90e647a96a	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-02 09:32:19.972+00	2026-09-01 21:32:19.973+00
b0a7722f-cc36-47d0-9a6c-9486f6a10919	2e27a2217a0e6706fcfcc559b276d7d9a3e3f82ee3b11d8f8a73292389946c62	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-02 09:32:29.302+00	2026-09-01 21:32:29.303+00
dd296681-7060-4795-b3ce-ae894bb6c8cc	7eec60a9ec8a956177b0fe66af66f8624773fb3f2dd3d18e685516d1ab8e419c	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-02 11:16:24.39+00	2026-09-01 23:16:24.405+00
1b90f9c7-24cc-4d54-b4d9-d903ae25001d	105f30c912922cf61c9b670345675aa142800b19fda86b6aed8a69430338f642	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-02 11:17:02.324+00	2026-09-01 23:17:02.337+00
01f46855-45f1-469f-9f0a-58cbbc5129a0	67f2cdc3e9f8df41ebe659ff43980507b28b9d967c6ad9e3ec86bc68b04eb02b	7d96c1bc-7329-413f-94c6-1c2f021eaed3	2026-09-02 11:17:30.962+00	2026-09-01 23:17:30.972+00
\.


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.admin_users (id, username, password_hash, status, created_at, updated_at, role) FROM stdin;
7d96c1bc-7329-413f-94c6-1c2f021eaed3	mariano	scrypt$16384$8$1$/Ppj0GrLTZJx1s6mokbVoQ==$E9dyHaMlBU9PLRN9mYdkHkprr7MCQtDZb/NI+pYZSYH0Ao7iyx6yn9exlQmrJtj99ZJL+DREcClhBgVENXvEsA==	ACTIVE	2026-08-21 21:12:09.501+00	2026-08-21 21:12:09.501+00	ADMINISTRATOR
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.branches (id, name, address, status, created_at, updated_at) FROM stdin;
12661d97-3998-4789-a9e5-44d72c5c7513	Carmesí	Pringles 321	ACTIVE	2026-08-21 23:38:46.418+00	2026-08-23 18:55:06.118+00
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
73644947-aa38-4239-b997-4c7b8f0f1558	5b5b5a93-2fe1-4cfe-958e-8f95c91624a2	MONDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-01 21:43:54.169+00	2026-09-01 21:46:57.977+00
a8cd00e9-506e-4d4a-9e3d-7e36c948e979	5b5b5a93-2fe1-4cfe-958e-8f95c91624a2	MONDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-01 21:46:57.981+00	2026-09-01 22:40:34.273+00
9f0492b9-2a00-43a6-b795-5a67929fb5bd	5b5b5a93-2fe1-4cfe-958e-8f95c91624a2	MONDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	INACTIVE	2026-09-01 22:40:34.277+00	2026-09-01 22:40:49.681+00
148f2c6c-af45-4a2c-a637-de9d7091ec74	5b5b5a93-2fe1-4cfe-958e-8f95c91624a2	MONDAY	22:00:00	23:00:00	7224e2cf-3eb5-4dcf-b086-aed42eabbff4	ACTIVE	2026-09-01 22:40:49.686+00	2026-09-01 22:40:49.686+00
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
5b5b5a93-2fe1-4cfe-958e-8f95c91624a2	COREOGRAFICO E. MASC- BACHATA/URBAN	7aea6ddb-5c16-4f2a-8d37-92fca2217cb9	5e3dfae4-8670-4dfa-a351-d889551ab3e7	1	30	ACTIVE	2026-09-01 21:43:54.162+00	2026-09-01 22:40:49.675+00
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
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.enrollments (id, student_id, class_id, start_date, end_date, status, created_at, updated_at) FROM stdin;
c914adaf-c8ad-4bef-91e6-8228b41698b1	8bed59f3-936a-4fdd-bf39-475c686481b7	ff270dd4-aef0-4546-aeb7-24aa94093098	2026-08-21	2026-08-23	ENDED	2026-08-22 01:02:10.427+00	2026-08-23 19:57:49.914+00
a1cd8d8b-f092-4b40-9644-509c3e71b55a	ddc77860-17e6-4310-a399-7ea7365f3ccb	ff270dd4-aef0-4546-aeb7-24aa94093098	2026-08-21	2026-08-23	ENDED	2026-08-21 23:41:39.025+00	2026-08-23 19:57:55.517+00
07e76d09-099f-47b8-a47b-0f2a9085abda	454a2da4-1337-4d63-bc8c-676b36c2098f	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.457+00	2026-08-29 02:23:08.457+00
7daa6195-adfa-4cd3-a21b-98e216551732	1eb674f1-d0c8-4e43-9414-f322dac17aa3	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.498+00	2026-08-29 02:23:08.498+00
27e17064-1159-43eb-9715-5a0ba0daf55f	997c0e8e-9152-449a-8ffb-9b68a7536349	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.527+00	2026-08-29 02:23:08.527+00
dd461a48-adde-435b-abe1-367fa1e7aca1	997c0e8e-9152-449a-8ffb-9b68a7536349	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.561+00	2026-08-29 02:23:08.561+00
dfb1c37c-4de2-4394-9e2e-7dc9c76c5110	997c0e8e-9152-449a-8ffb-9b68a7536349	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.593+00	2026-08-29 02:23:08.593+00
bc836422-a9d6-44b8-92af-13497e61914f	997c0e8e-9152-449a-8ffb-9b68a7536349	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.622+00	2026-08-29 02:23:08.622+00
667b69d3-a853-4a35-8290-b2612ff756c4	a6104629-708b-46d0-9b13-5d074bcbed25	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.649+00	2026-08-29 02:23:08.649+00
86269235-6937-4ea3-b186-6f15cc3c307c	fc1308bd-fc2d-474e-ab5e-688a861d6ab6	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.683+00	2026-08-29 02:23:08.683+00
a7ffc953-4a7a-4b70-82ba-0f2debb7c98b	2eaa7af6-8603-44a1-a71a-2407b668372a	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.713+00	2026-08-29 02:23:08.713+00
16bd52dc-0827-4123-9fe4-80f38594c798	bfd88cee-ae21-47f2-b6dd-72d57b145b31	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.744+00	2026-08-29 02:23:08.744+00
54073623-1d9f-4438-bc30-7dbf92194560	42e15f9c-7320-4458-9d43-d755b9fb8a03	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.778+00	2026-08-29 02:23:08.778+00
d1c77770-1c9b-47e9-8832-654f619542d9	79224b93-2a40-4d0e-85ee-caec0d3c3a01	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.807+00	2026-08-29 02:23:08.807+00
983c29bc-63e7-4eae-ae63-ce072edfc8a9	79224b93-2a40-4d0e-85ee-caec0d3c3a01	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.839+00	2026-08-29 02:23:08.839+00
4fffa97b-98c9-4b9e-9217-2b663efbb14a	afec60cd-8a2d-42c3-8730-ddc64ac4bfcf	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.87+00	2026-08-29 02:23:08.87+00
b1fbc378-9af1-4df1-9cb4-887eb553c2f0	4d6a3455-1ce6-44d8-846e-382899d35c73	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.9+00	2026-08-29 02:23:08.9+00
3d9651e4-ce92-4adf-8468-5d74f0e907fb	9cb09f48-0770-4af1-b9cf-54fae1fd15ef	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.935+00	2026-08-29 02:23:08.935+00
8078cb96-13cb-45f8-83d2-b62630baba37	ceec123a-5d45-44fa-a3d5-f325ebd18cd0	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.963+00	2026-08-29 02:23:08.963+00
a0234d55-9968-4ea4-829f-e6a36c1c5dab	2d2d8459-38c0-4d13-8c4e-217789edcce0	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:08.994+00	2026-08-29 02:23:08.994+00
e268b3ae-a38e-4d8c-a891-abbb3d478310	d9a7a5b9-cad3-45a6-9499-44d0e4fe8ce8	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.026+00	2026-08-29 02:23:09.026+00
b9acb006-2931-4f28-bbaa-026397a80fcf	a7c74644-d186-44fb-917b-3882623523b9	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.057+00	2026-08-29 02:23:09.057+00
90dc9b84-3ee1-4eef-95e2-2c772f601d2d	c047fbfa-5531-4b7f-ac51-d00609133285	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.088+00	2026-08-29 02:23:09.088+00
8268394f-2ab3-48da-b9d6-6ad804dbd54d	e3d42e74-cf95-499a-9ad2-35d0abf7e500	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.12+00	2026-08-29 02:23:09.12+00
450dab8e-cc4b-4cb6-89e0-2f0ba8e226aa	e3d42e74-cf95-499a-9ad2-35d0abf7e500	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.142+00	2026-08-29 02:23:09.142+00
c06bf612-fbfe-465f-9f7d-33e6573953fd	e535d5fc-d1f4-4e83-a5eb-47bca35ad4d2	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.165+00	2026-08-29 02:23:09.165+00
f0358837-25f3-4550-ab32-2bf034ee2c80	7a0da8cb-aeef-49cb-a4be-3773436f945a	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.185+00	2026-08-29 02:23:09.185+00
f6538920-7951-4797-97b5-a708a526fb1a	e85c8d41-7f2f-44ac-a122-5fac5e2f7463	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.211+00	2026-08-29 02:23:09.211+00
c84ad4ef-fd58-4b52-a059-00afff51b226	6523d623-9d87-4ab5-a632-765da7d2e604	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.243+00	2026-08-29 02:23:09.243+00
dbe50306-4c42-425d-9bf7-717191ca87c1	220a254e-381b-4236-9c90-c8fa2bae00c3	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.274+00	2026-08-29 02:23:09.274+00
05bdf441-111e-4151-94df-2f92fbd69627	a38e7370-fee4-4345-93ac-cf6ae5006b9a	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.304+00	2026-08-29 02:23:09.304+00
ed47d74a-5fc4-4fe7-a4c3-b615b67eef6b	15dccc6f-7cc5-475b-9704-768d3f3b7bcb	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.336+00	2026-08-29 02:23:09.336+00
54ea49b5-199e-4a95-bdf3-ceb1143ea367	15dccc6f-7cc5-475b-9704-768d3f3b7bcb	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.368+00	2026-08-29 02:23:09.368+00
1c2ab5eb-df2c-4f3d-8c3b-f76dd4a19127	15dccc6f-7cc5-475b-9704-768d3f3b7bcb	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.4+00	2026-08-29 02:23:09.4+00
4cedc994-5cab-4dd1-84bb-4bbd4069777f	ae113266-bea6-4ec2-b7ab-9841fbe7bde5	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.43+00	2026-08-29 02:23:09.43+00
879cd81d-7f71-4e72-a3da-4571a6821ee4	d9d2c6a8-42e8-45d8-a549-6f553ae8a4c2	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.461+00	2026-08-29 02:23:09.461+00
216dc74c-968b-41bf-9cd6-92654246809b	d9d2c6a8-42e8-45d8-a549-6f553ae8a4c2	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.491+00	2026-08-29 02:23:09.491+00
e4d06c2e-d22a-4b63-b6d4-a82a24eb6f11	824df025-def1-46c0-af0e-0477fd7a1719	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.522+00	2026-08-29 02:23:09.522+00
cc86acd4-4ea1-4f2d-83fb-ffeed34f35b1	a3a92c1a-d667-4962-b1a1-3c1ac3c5f365	2b9ee038-bf48-4bb5-9315-c2015733d11c	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.553+00	2026-08-29 02:23:09.553+00
334630a6-7ed1-4163-baf6-8e2ff76b26f0	08c5343e-fc53-41ed-bd41-05429bd7995b	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.583+00	2026-08-29 02:23:09.583+00
e980a2d2-a8b3-42d0-a19e-cc7910a58a0d	408771b7-b499-4521-bb0d-ac790af66da1	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.616+00	2026-08-29 02:23:09.616+00
d7fb4d41-d97d-404c-999e-07f3ed712ed9	d609ebd0-85ea-45c8-aae0-c8ad16036947	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.646+00	2026-08-29 02:23:09.646+00
e197eaf2-6df7-49e1-9050-2432306bc6fd	9967814e-bd85-4322-8516-09b903de0237	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.676+00	2026-08-29 02:23:09.676+00
9ff83e27-5c73-4691-b95c-1ac1b7607d32	9967814e-bd85-4322-8516-09b903de0237	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.711+00	2026-08-29 02:23:09.711+00
aa9aad11-b141-4fab-b698-abafe3332d66	9967814e-bd85-4322-8516-09b903de0237	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.741+00	2026-08-29 02:23:09.741+00
4b3f4cba-1b9c-47b0-8033-e86dc6de0eea	25c63902-bc14-4221-a549-441c09cf4768	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.772+00	2026-08-29 02:23:09.772+00
c1349c0c-3093-4dbe-a157-35e7751ed221	45cd7c0b-1f2f-435a-947a-f1301d2f99a3	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.804+00	2026-08-29 02:23:09.804+00
66bdc1fe-31ad-4156-add0-1ec8e780d325	27152b91-3376-464f-b17b-b011d278918f	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.835+00	2026-08-29 02:23:09.835+00
8cb1c60c-f7fb-4553-98c6-c31cabaac525	27152b91-3376-464f-b17b-b011d278918f	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.865+00	2026-08-29 02:23:09.865+00
4924a721-6a90-418c-9e18-9b22bce8fef3	074b51e1-fa83-411b-a297-0971b3e4f074	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.896+00	2026-08-29 02:23:09.896+00
69ead856-f1f4-4ee4-ab2a-1de459df358a	074b51e1-fa83-411b-a297-0971b3e4f074	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.929+00	2026-08-29 02:23:09.929+00
c6701bc0-1dc5-4499-9c0a-f7c0845e20b3	074b51e1-fa83-411b-a297-0971b3e4f074	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:09.965+00	2026-08-29 02:23:09.965+00
703341c8-6013-4d00-9a39-074c0bb71d3d	c9d07213-f8ad-40f2-b459-2be739cc05b7	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.008+00	2026-08-29 02:23:10.008+00
a8ab5ac2-9879-4bcd-a5bb-d63726ea796a	c9d07213-f8ad-40f2-b459-2be739cc05b7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.035+00	2026-08-29 02:23:10.035+00
dc019bd9-7bb9-4688-b23d-082ac2088e97	8456df92-458f-4081-9a21-e926ef940a0e	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.066+00	2026-08-29 02:23:10.066+00
e212c100-cbcc-4a05-a571-3e64a08f1b1f	8456df92-458f-4081-9a21-e926ef940a0e	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.099+00	2026-08-29 02:23:10.099+00
14b43222-dc42-4861-bfbe-9a85f60718cb	97e34e29-16e6-4644-aa44-0f7c88dba8aa	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.13+00	2026-08-29 02:23:10.13+00
fe6b20b5-a837-4220-96ce-7dfb2cb24674	97e34e29-16e6-4644-aa44-0f7c88dba8aa	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.163+00	2026-08-29 02:23:10.163+00
677e814f-65da-4baa-bfd0-d67c2d94dc17	97e34e29-16e6-4644-aa44-0f7c88dba8aa	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.196+00	2026-08-29 02:23:10.196+00
8391b952-cff0-4051-af5d-727bf7a9305f	97e34e29-16e6-4644-aa44-0f7c88dba8aa	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.224+00	2026-08-29 02:23:10.224+00
6ddc6e3f-7b76-4924-aefa-dc5f58693a76	5a8926bc-871e-4beb-a27e-91c00f38f67c	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.253+00	2026-08-29 02:23:10.253+00
e197b78c-75a8-4959-a142-40aad231c434	ce69fede-102f-4ba9-9ee8-5a9889f98676	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.284+00	2026-08-29 02:23:10.284+00
48606f18-b95d-491b-aebb-853fe3cf9ea2	aa6f3582-c3be-4632-a28b-6a52572af725	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.315+00	2026-08-29 02:23:10.315+00
cd6301f0-6bfa-49e0-b66c-83c2013f3602	4e6cb7ef-a16e-46a8-9e0c-9f72abd6c513	2b9ee038-bf48-4bb5-9315-c2015733d11c	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.351+00	2026-08-29 02:23:10.351+00
aca14f90-9e94-40ad-973a-02cd7bb728fa	0138b18b-e037-47a5-ae52-fbe92f0ac7ff	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.379+00	2026-08-29 02:23:10.379+00
c187cfbe-8308-47b7-8b64-a9efa6947c07	6290ccdb-2615-4ba3-a563-e55e6f5333b9	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.409+00	2026-08-29 02:23:10.409+00
c85563ae-f620-43f8-a1d3-af281ddd7330	7f5c0637-0f59-4fbd-b65f-cf09cbb25687	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.442+00	2026-08-29 02:23:10.442+00
d79f04c2-ca72-4afc-b6e3-e0b9a1f27f0d	7f5c0637-0f59-4fbd-b65f-cf09cbb25687	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.472+00	2026-08-29 02:23:10.472+00
824d7160-dd8c-41e2-8b10-f61222407028	e2f3404c-63d7-4c3b-b434-45549922ea59	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.502+00	2026-08-29 02:23:10.502+00
d2f857cb-50e5-4dbd-80f1-b7c40ef18cb2	fe2876e4-6433-4d44-a5e3-89a8a0d67433	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.534+00	2026-08-29 02:23:10.534+00
c507451a-a69e-41c0-bc9d-bd625a76c4b0	f5ca223e-79ec-4546-a181-36a488589191	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.566+00	2026-08-29 02:23:10.566+00
72d15c2a-eebf-4405-bfc3-5d51f5ffba35	df2e9a16-b155-43e6-9ffd-e70c5026481b	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.595+00	2026-08-29 02:23:10.595+00
9494f045-39f5-4152-b08d-6c81a1ff00df	df2e9a16-b155-43e6-9ffd-e70c5026481b	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.63+00	2026-08-29 02:23:10.63+00
62336ef3-f403-4649-b60e-eaa90e2f7994	5661b9ff-03e3-4951-b426-09dc613a59f5	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.66+00	2026-08-29 02:23:10.66+00
62f7c8f8-6cd5-4547-ab18-f18ee4b8f504	89b51d7f-4a99-4805-8f75-13b32420f8f0	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.69+00	2026-08-29 02:23:10.69+00
ca390232-a9e8-40b3-af1e-0400387bcbb7	40950d87-dc66-405f-9295-7b0625b592aa	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.723+00	2026-08-29 02:23:10.723+00
446d48bc-b72a-434c-a9ff-b2d930dba75f	f2aae84b-e156-4d9d-81f3-d50a56e02255	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.755+00	2026-08-29 02:23:10.755+00
262b19f7-109b-400e-a06f-3f1cf24a4b9e	f2aae84b-e156-4d9d-81f3-d50a56e02255	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.779+00	2026-08-29 02:23:10.779+00
f1127eb6-4f70-4c4a-aa15-4ff037faabbc	d5c24860-da44-4c74-b22a-97bdf8f42c22	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.817+00	2026-08-29 02:23:10.817+00
821ed7e9-4663-4924-8b4c-112efa6e4601	b8bae188-1b10-4118-8cd3-e97cfd4aeec5	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.848+00	2026-08-29 02:23:10.848+00
72efbb6a-3a57-4773-a5b7-ebf984b82751	9254f230-7913-4feb-be5c-1264137f3b9a	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.879+00	2026-08-29 02:23:10.879+00
908c3761-e400-4060-a732-1527991f2fd7	16c93792-8688-4a6d-89d3-ca97e4ad944f	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.91+00	2026-08-29 02:23:10.91+00
9c797deb-6d4c-4d88-b430-89fd1843df7f	64a99306-c339-401e-8461-d2c2f93b0c61	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.942+00	2026-08-29 02:23:10.942+00
a69a236f-ad70-4ef7-9a36-1782a6f6424d	674c8e8e-1a1d-4c62-9785-16d526fd3c95	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:10.974+00	2026-08-29 02:23:10.974+00
a903a415-fd3f-473d-bca8-94d8df8f28de	d60d7504-4213-45c0-9757-7646d010dd1a	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.006+00	2026-08-29 02:23:11.006+00
42cf5454-9699-4b03-800c-35fe51589f73	440f71df-52eb-4c53-9b3a-a7ee701c29ba	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.036+00	2026-08-29 02:23:11.036+00
8207e702-e5e1-4b43-8f75-060d4cad4382	dd5e52c4-3ac5-468c-b81e-32744f518de8	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.068+00	2026-08-29 02:23:11.068+00
ad855591-50b0-4e87-8eb6-66dd7d559f1f	d5bd7500-6267-473f-aa6a-1d5f129fe33c	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.099+00	2026-08-29 02:23:11.099+00
2d4fb39b-11c2-4a5d-9307-9879b594d770	56bd8b07-68d5-4c19-b828-2bfeb4fbfb3e	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.131+00	2026-08-29 02:23:11.131+00
1e36db58-169b-4923-bf55-0e3bd5226cf6	a337c9c9-e4e9-4fdb-a634-b7a84d3ede86	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.163+00	2026-08-29 02:23:11.163+00
6c43601f-6b6f-4f4e-b0db-5e45292dc39e	fcfce898-5c18-4924-93cf-1b7036f11ba5	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.193+00	2026-08-29 02:23:11.193+00
fb6e41ec-8d17-4099-a2e1-9ad9646bdd6d	2896238a-f2a3-4c9b-8ea2-22083e8f59a9	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.224+00	2026-08-29 02:23:11.224+00
c59c8931-a690-4f76-8b43-ca1c3041294a	26ec3b0a-5193-465e-9d38-45cfb38ae0b3	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.256+00	2026-08-29 02:23:11.256+00
6ca889ba-7c4e-4a04-be82-051b975c34e8	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.287+00	2026-08-29 02:23:11.287+00
c91bf3aa-0c80-43c2-9526-99f3a45d3cb7	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.318+00	2026-08-29 02:23:11.318+00
2a6ad745-05a9-4b74-bb00-5d66b221752f	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.35+00	2026-08-29 02:23:11.35+00
5a1b5302-ecb3-406d-9f68-06a1b67f119d	4deb1a11-1f3b-47f4-940d-f6bdfbc54840	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.381+00	2026-08-29 02:23:11.381+00
272f4993-c935-4f72-9192-70f5497afa2b	757fbdf4-80af-4d43-ae09-fb75ece1a012	2b9ee038-bf48-4bb5-9315-c2015733d11c	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.41+00	2026-08-29 02:23:11.41+00
dd9857b9-8502-4bb5-a1b6-22ed7694180b	528f5372-4d0f-4864-92b0-93d8bd6d1a93	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.442+00	2026-08-29 02:23:11.442+00
e58e1908-a9ac-4b7f-b7dc-9da5595de45a	528f5372-4d0f-4864-92b0-93d8bd6d1a93	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.474+00	2026-08-29 02:23:11.474+00
6067ecc8-7f73-4706-994b-dfe7b6043900	8d18ee38-ca45-4ee5-af25-2df796d371eb	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.504+00	2026-08-29 02:23:11.504+00
3fac09ba-5286-450e-a187-b9445a39a109	064dfa74-0e77-44eb-901f-93e457ef4a65	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.538+00	2026-08-29 02:23:11.538+00
8d4d413e-2f89-4533-97be-6ead75ef9489	955a0573-f1c3-4810-84bd-f657fd6b734c	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.568+00	2026-08-29 02:23:11.568+00
34bd6178-6c00-4210-a5f0-00b16dcb0d77	955a0573-f1c3-4810-84bd-f657fd6b734c	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.6+00	2026-08-29 02:23:11.6+00
8fd95b2b-862b-416e-a0f5-f19adce933f8	9a24244d-0c3b-461b-95c7-57d682862292	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.631+00	2026-08-29 02:23:11.631+00
846e044a-aedc-4490-9d6d-ee4002e3f0b4	aa4f35db-ca8b-4829-ab74-60c57521f462	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.66+00	2026-08-29 02:23:11.66+00
c4cbe39d-8828-4f5e-bc59-3e3a3c172917	287e8a09-5b0b-40e6-8c30-3fb6c065dbff	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.691+00	2026-08-29 02:23:11.691+00
9150e89a-f4fb-44f4-b080-621d1116c9ac	5bb9359d-768a-4cce-a92c-16a95641759f	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.722+00	2026-08-29 02:23:11.722+00
58ffe3b5-90e6-4b00-8cfd-4f0c471119cf	f237f4bc-8093-431f-8598-ff503ef70187	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.753+00	2026-08-29 02:23:11.753+00
6789125c-821e-4618-b76e-7f6f50e74af7	f237f4bc-8093-431f-8598-ff503ef70187	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.784+00	2026-08-29 02:23:11.784+00
ea8f292c-0152-453e-8a0c-9dfb78be4da7	668965b1-0738-4249-b880-ac0dff06a17b	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.815+00	2026-08-29 02:23:11.815+00
efe1c7c5-34ea-4e9d-8ac2-c39b239233c7	bbfad32d-4feb-40a4-8fea-90c12297c9d7	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.845+00	2026-08-29 02:23:11.845+00
df4e87a0-6dfc-4f10-a501-b701e899b1ff	598cc625-80fc-4755-acd8-a4d0f57e7641	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.876+00	2026-08-29 02:23:11.876+00
add0649b-99b5-4832-a920-df0c09ee03b5	1071b1bd-3026-4810-b527-6d33437e99cd	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.91+00	2026-08-29 02:23:11.91+00
b251e2c9-b8ff-4c6e-be60-314ebb86945d	e131203a-d7c6-40a0-bcd4-062e41335e8f	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.941+00	2026-08-29 02:23:11.941+00
5f312c32-1003-4ba2-9f07-8eba908f7575	808556f1-82dc-46fb-b058-5f13582c4b8f	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:11.971+00	2026-08-29 02:23:11.971+00
6a8c4084-48b1-4da8-890d-6f2c811aee42	808556f1-82dc-46fb-b058-5f13582c4b8f	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.004+00	2026-08-29 02:23:12.004+00
ba663c8b-78b1-40f6-ab11-c91e8b82ddd0	f0bf368a-4c7b-40a1-9ce3-c7f4719efec9	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.034+00	2026-08-29 02:23:12.034+00
0336cf0a-2b57-4e86-93c2-a39e5f6682ed	8a27a773-fda2-4bd2-ac79-caaf4bf972fe	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.065+00	2026-08-29 02:23:12.065+00
1d5ecf7e-b20f-4626-99d8-766cca96a82f	b0bb2d93-1d20-4cf3-8867-2250bd830889	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.097+00	2026-08-29 02:23:12.097+00
1e5270bb-cf5d-45fd-b160-fe766c48a2d4	f20f54d6-ebcc-4829-b110-67f0c1c7aae1	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.129+00	2026-08-29 02:23:12.129+00
9ed439ed-809c-45c1-8dde-ad4977936276	ff5d8b46-3458-40cd-a9a8-9b47fc500d33	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.158+00	2026-08-29 02:23:12.158+00
fd172c23-5b49-450c-be20-1a9308e0a53f	f78f638a-546b-4e50-afc4-d54f655bf96a	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.19+00	2026-08-29 02:23:12.19+00
97924a23-2721-45df-89ea-629dccf4073a	18c12bef-a4e7-4fc1-854a-91c8347c48f9	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.222+00	2026-08-29 02:23:12.222+00
c9a452ce-e16a-4d47-a067-e5c2f6e40360	ddf38b55-0d22-466e-b13c-c67a1631f7f3	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.25+00	2026-08-29 02:23:12.25+00
8ffdc7fa-ef04-4607-b5bc-98bbbc5b4451	8ecb69c8-daf6-4b1b-869b-348c8cd2d4a1	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.283+00	2026-08-29 02:23:12.283+00
84d5dce8-cc10-439c-b293-30c09836281f	132b2658-c520-4be0-9f93-93827720fdf1	0dd78cf5-7a17-455c-9a70-1175a12d327d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.315+00	2026-08-29 02:23:12.315+00
fd9ee0ed-dcac-460e-830f-9b2cff826d98	0304d8cf-6f00-41a8-a675-b98592bafb97	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.344+00	2026-08-29 02:23:12.344+00
364ab26d-bde3-4a73-95d0-2d9bada46a25	0304d8cf-6f00-41a8-a675-b98592bafb97	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.376+00	2026-08-29 02:23:12.376+00
bcf0f2e9-4a11-457c-8eb7-e82fd4b7b776	fc282a39-09ec-494f-a177-ccba97d90797	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.406+00	2026-08-29 02:23:12.406+00
9be516fc-051a-420e-92d4-1e004b4df42a	fc282a39-09ec-494f-a177-ccba97d90797	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.437+00	2026-08-29 02:23:12.437+00
e0bec1ce-d547-4e81-a46f-79f0977ffd6a	bfa38797-b517-4143-b7d1-0c893df2af11	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.47+00	2026-08-29 02:23:12.47+00
677485ff-90ae-4541-aa32-05894f2d9916	c6108d50-a4d4-4193-8305-c3e06b7eaf17	b96017bd-9ee1-4bde-ad35-ad961a78e5f5	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.5+00	2026-08-29 02:23:12.5+00
0e123909-bfa4-490e-90ae-530c6e98070f	b17eaffc-65da-459b-85ac-e1ddbde9c54e	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.531+00	2026-08-29 02:23:12.531+00
9d584459-467b-46d6-856b-b92873bd7210	dab98409-0209-4981-a923-b964aed7d26f	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.563+00	2026-08-29 02:23:12.563+00
6faccecb-2be5-4d78-9e10-700be0047f9c	0f66f0ff-d9e6-4195-94bb-060aeafe2502	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.594+00	2026-08-29 02:23:12.594+00
108d25fa-9107-4131-bbfb-5bc1e85d0222	161530a6-02b6-40ea-a32d-1d7df44b787b	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.624+00	2026-08-29 02:23:12.624+00
741acf2d-dfe9-4dd1-8d94-940749ca56e0	790eae5e-6087-40a6-b640-651843ec4646	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.657+00	2026-08-29 02:23:12.657+00
d06ba8db-971b-4611-a866-faf086707c2f	b68131ac-a62d-411a-b2ed-5ebe901a5ab8	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.686+00	2026-08-29 02:23:12.686+00
f06ff8b1-5984-4900-b7a0-ee9c6c87524b	88dcb0b7-845e-4f80-9584-ab11d60786d0	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.717+00	2026-08-29 02:23:12.717+00
ef18b707-0f2b-4a67-a2ac-319f417f6b29	85a80831-c1f1-4c7e-8198-ee05d349a8f4	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.749+00	2026-08-29 02:23:12.749+00
59c589da-3a44-41f0-813f-8c87c215d133	60ffaac9-4651-41d0-8f32-23d99aa67420	d0762bb4-c6ef-45d4-8414-5ae0f158831f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.779+00	2026-08-29 02:23:12.779+00
e3d1b240-ba9d-4b00-9991-9f72e58ed76a	60ffaac9-4651-41d0-8f32-23d99aa67420	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.81+00	2026-08-29 02:23:12.81+00
a31491f2-90cc-448b-bc80-2ff825ef5e12	60ffaac9-4651-41d0-8f32-23d99aa67420	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.842+00	2026-08-29 02:23:12.842+00
cb879a9f-a9ba-4c87-872d-e71a520e4518	c976f4cf-e794-4697-a578-76e46a4d7c57	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.872+00	2026-08-29 02:23:12.872+00
f5106f21-fc88-4a1d-b7f7-f144eaf686d5	daada42a-8ccb-40ad-b8c8-66f65dcf2a39	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.903+00	2026-08-29 02:23:12.903+00
f1ab3374-8eb7-475b-88dd-0bce75ddb025	daada42a-8ccb-40ad-b8c8-66f65dcf2a39	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.936+00	2026-08-29 02:23:12.936+00
ca875684-25f3-46cf-9245-6f3afa3c9ab2	29244aa1-ed07-4256-903a-b69d13078eab	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.966+00	2026-08-29 02:23:12.966+00
2a10630c-984d-4eed-b63c-1e32adb3d6cf	e6d631b5-ec70-460b-9835-66eabfb66176	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:12.997+00	2026-08-29 02:23:12.997+00
2c9f5f00-40f6-4cee-a33a-e30d05c08792	e6d631b5-ec70-460b-9835-66eabfb66176	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.031+00	2026-08-29 02:23:13.031+00
b59c5cbd-ab51-4f86-8b7b-a5313225bd74	e6d631b5-ec70-460b-9835-66eabfb66176	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.061+00	2026-08-29 02:23:13.061+00
2c98df00-09f4-4ae5-aca8-7ccbce71e645	21220e88-5f94-4c2b-9a9d-b3c0b21c3c44	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.081+00	2026-08-29 02:23:13.081+00
14885617-4c4a-485b-a812-f421e3aeec7d	218e3a17-234c-4b08-81df-613ece4a4606	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.107+00	2026-08-29 02:23:13.107+00
21e68f45-8f24-4ca2-8811-81d39230d5af	d1667b8b-ac3a-4f37-8e6b-4b75dc5f1418	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.14+00	2026-08-29 02:23:13.14+00
b540cab0-4dc5-42b7-8eea-c458bee72aec	9890b644-50c6-47a6-9ff4-ced2356cfa6b	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.17+00	2026-08-29 02:23:13.17+00
d8556163-6a96-47cc-93f7-8587bf14e441	9890b644-50c6-47a6-9ff4-ced2356cfa6b	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.202+00	2026-08-29 02:23:13.202+00
cc8729c0-5918-4543-83b7-4f3efc32a84b	9890b644-50c6-47a6-9ff4-ced2356cfa6b	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.236+00	2026-08-29 02:23:13.236+00
c12d932c-ed66-41bf-b0e3-7951c7f5aa53	2167fac4-4feb-42cb-815d-a3f9a7b2e2c8	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.271+00	2026-08-29 02:23:13.271+00
7ef87448-5616-4244-99eb-e502c671d911	6a556835-d1d2-4a99-8888-3e47ae0cc87c	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.311+00	2026-08-29 02:23:13.311+00
4a7f0fed-2e85-40a3-b6eb-0eadea007e59	c9987164-f80e-4908-af0b-ccd57b667bd7	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.348+00	2026-08-29 02:23:13.348+00
b709dfc8-6ba3-45ab-93b2-06fb2d057193	6617b5c0-3cc9-4197-b7ed-d9bd279a674f	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.405+00	2026-08-29 02:23:13.405+00
87dbe8b1-3837-47f1-9fef-da9a8be9f9ab	6617b5c0-3cc9-4197-b7ed-d9bd279a674f	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.438+00	2026-08-29 02:23:13.438+00
97f59f09-2841-4691-929e-ff86cf773d4b	a6360973-3706-48fd-8f1c-8cba57b53f8d	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.468+00	2026-08-29 02:23:13.468+00
02ddd619-230c-4032-9b37-15360f07bfbc	88f8e49f-6866-4aa4-8a6c-20a69ce1b7f4	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.498+00	2026-08-29 02:23:13.498+00
efb610bc-02e8-42c2-afc6-30fcac84da8b	d820f750-e7f6-4311-a204-a6994384d585	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.534+00	2026-08-29 02:23:13.534+00
c94467c6-5442-46b1-90b4-58e440fd15eb	d820f750-e7f6-4311-a204-a6994384d585	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.583+00	2026-08-29 02:23:13.583+00
0e52d82d-93ef-48f3-9736-3eb4076d9493	e0d23592-89d1-42df-a4b5-a726468411be	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.621+00	2026-08-29 02:23:13.621+00
6e5f858a-dac9-4ed4-abda-096737627dfd	b081171b-df46-4671-8679-cdb140896300	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.65+00	2026-08-29 02:23:13.65+00
6e5e090d-823b-4292-9ce2-9fdf057c07c3	883d9857-a34a-43cd-8467-bb67ba08d27f	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.679+00	2026-08-29 02:23:13.679+00
2ca0812d-7f61-446c-9217-cde43fef8629	36fbeaff-eaf4-4acd-bfed-95fe5e3d07c3	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.712+00	2026-08-29 02:23:13.712+00
ad3d6cb1-4ca4-488b-b0b3-50de931755b2	fb345864-a1e9-4afe-bd89-f7afd399f849	4074b25f-622a-4423-ac82-9d0cf90e3666	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.745+00	2026-08-29 02:23:13.745+00
aa4de275-e0ef-48ba-9fa3-ac09e7733d87	fb345864-a1e9-4afe-bd89-f7afd399f849	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.777+00	2026-08-29 02:23:13.777+00
dc710853-0a16-4238-a849-6ac0cc8cbeb7	a8eb74e2-1946-460f-be24-c9f4466e9d7c	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.804+00	2026-08-29 02:23:13.804+00
618dec37-fa62-4126-8f71-1800825d93f8	022f2847-381c-4541-891f-0f38253235f5	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.838+00	2026-08-29 02:23:13.838+00
a1a2e5de-6907-4c89-bf5b-a959bd15c863	7ad17a5c-8489-4f01-858b-b171b6282e03	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.869+00	2026-08-29 02:23:13.869+00
d88067e7-c807-43c9-9ac1-6b7d13b25a62	1e53518b-8e46-4670-a5c6-72c101b35134	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.901+00	2026-08-29 02:23:13.901+00
af7c7fc8-6289-43bc-a865-3ed87785fe58	0ce33854-cda1-4646-921d-d63a51e672d8	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.931+00	2026-08-29 02:23:13.931+00
d2fb15e4-533a-4cae-9044-e45d7d45dfe2	da3087f6-e133-44b6-b62b-a9c53836e170	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.964+00	2026-08-29 02:23:13.964+00
fb812eb2-323b-49e4-a4db-1f9b89335888	5a2db33a-7b69-4246-9b6f-b882dfd79764	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:13.992+00	2026-08-29 02:23:13.992+00
c18cb91d-7d51-4a6f-a6f2-33c365a57d46	9e6f4296-6c59-4e21-919d-5394e6e48ad2	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.025+00	2026-08-29 02:23:14.025+00
04a8bd30-efff-4095-b38d-3fcdaacd90df	a4030ecd-e658-4a4d-a015-e7d9302e6d58	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.056+00	2026-08-29 02:23:14.056+00
a55f1d83-95b0-4ed1-82c1-915f89f741ae	a4030ecd-e658-4a4d-a015-e7d9302e6d58	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.092+00	2026-08-29 02:23:14.092+00
73540a7e-dc2e-46bd-a2d9-0014cf41ba53	ddd1ae0f-e5b1-4aa5-a1e7-5a96798d5786	5e8e8fd7-a08b-4443-8ba0-30ee263ffa1b	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.12+00	2026-08-29 02:23:14.12+00
5565ac81-f785-42c8-8f91-21aa0992bbad	f1998bf5-63a4-4990-b367-82d4124a9cdf	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.152+00	2026-08-29 02:23:14.152+00
4cba1d2d-a4bf-4c3f-a809-9a783d1a6323	794257b9-33ab-441b-bee9-27812e22be9b	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.183+00	2026-08-29 02:23:14.183+00
f31bec5c-f1cb-471f-9151-3670c1fd52dc	e775ae54-82f6-431f-8b77-e66485f4d4d8	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.216+00	2026-08-29 02:23:14.216+00
5dfe6754-f87d-4f3f-9d4b-24317f65d117	e775ae54-82f6-431f-8b77-e66485f4d4d8	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.261+00	2026-08-29 02:23:14.261+00
5fe3c8b0-9f11-4116-9c4e-864857dd264a	32a952d0-5c16-456e-be91-e928d6ca4eef	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.291+00	2026-08-29 02:23:14.291+00
11f4fdd7-c12e-4d23-9556-d912040b3d54	32a952d0-5c16-456e-be91-e928d6ca4eef	ac972b45-74ce-49f8-be10-3a6f0151da82	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.323+00	2026-08-29 02:23:14.323+00
d5ff245b-9346-439a-8f4f-da707c25fb15	21c54b2e-1542-4f84-a96d-1758f848b973	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.359+00	2026-08-29 02:23:14.359+00
0335f2da-8f7f-495c-a510-14505b54ed56	e89fd784-8b1d-4be3-b410-2482f9b94d86	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.405+00	2026-08-29 02:23:14.405+00
ee008ad3-2ebd-4791-8346-6c4e01d616df	46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.43+00	2026-08-29 02:23:14.43+00
a3f629d5-a079-4e65-9a7b-6b63e52a72b1	46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.467+00	2026-08-29 02:23:14.467+00
ddbf6134-fc66-4bc0-990c-13ac16fb23b0	46c94200-44c3-4d33-8a1c-3b5cbc7d6ef8	71bc486f-8a3d-46bb-a102-838cfef0a1fc	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.507+00	2026-08-29 02:23:14.507+00
d03e7b63-654a-4698-9e9f-2b57647a3f3a	6dca4c54-e7dd-421a-bda6-d4881238236d	4cd54a73-4b21-4bd6-ae3f-7008b4e51e4a	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.528+00	2026-08-29 02:23:14.528+00
d59dbdfb-4111-43b4-811b-4a61eeb2bcd2	482fb776-5b73-4d29-b4d9-81ed1db5aa45	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.553+00	2026-08-29 02:23:14.553+00
938d7e10-3c2a-403a-8074-aea33227512b	7384e63e-d9e2-4c9c-818b-d98579f2dba8	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.585+00	2026-08-29 02:23:14.585+00
ee0fa5aa-ecf7-4507-8780-35789ef95a6d	78a30a79-2e8a-497a-a971-98c900e8197e	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.619+00	2026-08-29 02:23:14.619+00
ca8b0125-30c6-4c92-8ed8-1cdb3d919ca6	df69102b-aa50-44da-8cac-a0e502072582	cc392129-75e3-4205-b7fc-fafceb55b996	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.649+00	2026-08-29 02:23:14.649+00
2406e794-18c1-4222-b8e5-74518bc30151	d8f72c2c-5e42-4238-801d-6c30ba14b5d2	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.685+00	2026-08-29 02:23:14.685+00
c8ecc0d9-c8fb-49a7-83a7-c5f7b060eb0d	14fa3093-57f8-435a-8f8f-abc4279c6f26	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.712+00	2026-08-29 02:23:14.712+00
94a878eb-5fd1-44e6-8cd2-fc89ea3a5ff7	14fa3093-57f8-435a-8f8f-abc4279c6f26	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.741+00	2026-08-29 02:23:14.741+00
24563f81-b88c-4a31-87dc-f99e680794b8	14fa3093-57f8-435a-8f8f-abc4279c6f26	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.773+00	2026-08-29 02:23:14.773+00
bf63fa09-3a9a-4561-a8c7-357ab803500c	c5e570bd-6a3f-4e60-a1bb-c6fa5e823cf2	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.802+00	2026-08-29 02:23:14.802+00
7e0b6822-956b-460e-b875-560bd1185249	7042c4d8-7739-41bd-8ae5-676cec196953	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.834+00	2026-08-29 02:23:14.834+00
9924272a-de32-4d2b-b4be-31022f0f3f54	793d1985-0bcc-4d43-93be-fd4df9cf2e39	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.864+00	2026-08-29 02:23:14.864+00
52a50c78-df99-4cd3-88ad-6a6fefea748a	ba9de018-4dcf-4c09-931c-4d569ebdbe1f	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.895+00	2026-08-29 02:23:14.895+00
85ab018a-b375-4100-846c-48027433d12e	d29a7fa8-7611-4762-94cd-4680bc6ce241	acbbc26b-2a55-4952-97a0-92dc025024d2	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.928+00	2026-08-29 02:23:14.928+00
3f2cf1c5-8b5c-4b89-95ab-b722d76cd180	77acbe8a-5a4a-4233-842f-a6ec1887d562	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.958+00	2026-08-29 02:23:14.958+00
28767b4e-0b0f-4c06-952c-5919375861a7	90d7e5d0-0b7e-458a-8d99-faa82cce9d68	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:14.993+00	2026-08-29 02:23:14.993+00
79a3bb65-4169-466b-85cc-217e9625b46f	82ff4d34-ee44-42be-9248-0c68dc00ce14	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.021+00	2026-08-29 02:23:15.021+00
27e77571-f588-468b-871f-0904be7131b1	7155ff13-ed1e-40fc-af42-d30383691132	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.049+00	2026-08-29 02:23:15.049+00
e9d73d91-e79b-4291-a427-a7056a3373c2	8f82478a-a7b6-4960-853c-cf371cead592	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.078+00	2026-08-29 02:23:15.078+00
8fd64891-a2cc-4e08-94e4-01c0a7ce3b08	8aed5d20-bbe6-4316-b78b-0e6cd9de1ace	da4d15d9-c846-4098-8640-e95fd97c604f	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.11+00	2026-08-29 02:23:15.11+00
5db84a3e-f483-4667-a7ca-23d9cf50249d	eb25e923-17e3-4ec6-9804-c1bf33139d7e	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.129+00	2026-08-29 02:23:15.129+00
efc63ca6-264a-4c6a-bdbc-f33bfb76ac37	327106db-080d-4a7a-a7d2-b8fee7b19d83	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.156+00	2026-08-29 02:23:15.156+00
5ae97a03-0bd7-4ead-af9e-b4b6c0f9ddb0	8aacb8af-ee64-4623-8933-16f754b34eb1	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.188+00	2026-08-29 02:23:15.188+00
47ae2631-91ee-4ff7-91b1-368a713b932c	54306e75-e1f7-46b7-bc56-81a432fea581	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.22+00	2026-08-29 02:23:15.22+00
26fd9e54-9a6a-4f07-85bd-2a7778561c78	2d77e8b7-c2d6-472c-91b0-c3af17e916e7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.25+00	2026-08-29 02:23:15.25+00
19ba6290-6517-4d0b-b691-c35bbf62ab2f	9d4e1bb6-b6c2-4b23-8a80-535307c3c8eb	4b2663bf-5ab4-42e5-865c-2af4da2cf5ff	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.28+00	2026-08-29 02:23:15.28+00
0d8c35e5-3a79-45b5-87e4-d91ccfbaddde	c4cbc2b3-137b-4a1d-918a-69d45e26f725	dd4b0323-e82f-4b02-89c0-0f8e520033ed	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.313+00	2026-08-29 02:23:15.313+00
4209760c-fa9f-4ed9-a701-05ef616dbaf7	61451526-5906-420c-9d49-ac14b3e7e1e7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.341+00	2026-08-29 02:23:15.341+00
c23136b0-96f1-4f27-ae3d-c642b5a09010	c3e2f29d-7147-4ffd-967b-ec3c9472b6ac	f8a32bf2-9e2a-48b5-9f2e-a8b9da860fb3	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.372+00	2026-08-29 02:23:15.372+00
5f6d3dd5-1e91-40a4-91ce-b5d5cc52f42d	a5f67efa-a60d-465c-996d-acc357010e3b	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.404+00	2026-08-29 02:23:15.404+00
49539e1a-7e3f-47e7-a398-4b49fa3b707d	a5f67efa-a60d-465c-996d-acc357010e3b	06f93e1a-5cc0-4741-8ad6-813745ea389d	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.434+00	2026-08-29 02:23:15.434+00
130ff8fb-70c3-4760-9960-b27893a990f1	a5f67efa-a60d-465c-996d-acc357010e3b	b9c792eb-ea2e-47f5-b436-f6cfe5c5ac26	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.464+00	2026-08-29 02:23:15.464+00
b1bfcb37-5405-4822-94fe-9f84bfc44bab	b48cbe49-b182-45ec-a845-5a64ef0ab8b7	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.496+00	2026-08-29 02:23:15.496+00
11c8cc73-13be-439a-a8ff-f95a57684f45	bc06e985-bd2a-4319-bf66-8880c6e4e46d	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.527+00	2026-08-29 02:23:15.527+00
b8bca902-7b92-48e2-8335-0df4287f7958	431cfc10-dbfd-446e-882a-a07f2f1e70e8	bcea570e-e3dd-499f-8a4b-88f079773871	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.558+00	2026-08-29 02:23:15.558+00
e252aec7-2d70-4164-b895-d9267304411e	e0e12c86-9b1d-4fd0-914a-62fc37f00dd1	50f07573-4f58-4314-a0aa-e2e2d0feae71	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.589+00	2026-08-29 02:23:15.589+00
63742952-9ce9-4879-8c78-22dafd4f4255	b2566873-7ef4-4c30-b0b8-6f71f092436e	576c192b-8d45-47e9-bd94-df027445d793	2026-08-28	\N	ACTIVE	2026-08-29 02:23:15.62+00	2026-08-29 02:23:15.62+00
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
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.payments (id, student_id, amount, payment_method, status, paid_at, created_by_user_id, voided_at, voided_by_user_id, created_at, updated_at) FROM stdin;
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
19f767fa-46c2-4be1-ae6e-fed5917a42c2	900000001	MICAELA	ALBARRACIN	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.448+00	2026-09-01 23:16:24.487+00
3f3a642c-5fa0-4711-ae65-672148b74822	900000002	CRISTIAN	ARMOA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.506+00	2026-09-01 23:16:24.527+00
9c01c06f-2308-46f3-bb4b-4346037da818	900000003	GUSTAVO	BARBOZA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.542+00	2026-09-01 23:16:24.564+00
d02ba4b9-5554-4ffc-8b8e-16153848d2a7	900000004	LAURA	BAY	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.578+00	2026-09-01 23:16:24.597+00
90655459-86be-4d37-800a-a9a6222c3d19	900000005	JUANA	BENITEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.612+00	2026-09-01 23:16:24.631+00
035b5843-2ae2-4d7d-9cc5-fb59cef2107a	900000006	AGOSTINA MICAELA	CABALLERO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.645+00	2026-09-01 23:16:24.662+00
2a2e6f64-2574-4e4e-84a3-53e8af6ed29d	900000007	AGOSTINA	CACERES FERNANDEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.675+00	2026-09-01 23:16:24.691+00
e376b96b-d32d-48c7-8e3a-28a9f7d77884	900000008	MIA	CARRERA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.703+00	2026-09-01 23:16:24.719+00
f92f8165-7ab7-4879-a946-aae176a9ddf1	900000009	CAMILA	CASTILLO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.731+00	2026-09-01 23:16:24.748+00
bd35a90f-ad49-49f4-980e-92690eec62ff	900000010	YAMILA	CENTURION	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.76+00	2026-09-01 23:16:24.777+00
e62b3706-2430-4170-9bf2-95599315973d	900000011	CLAUDIA BEATRIZ	D AUGERO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.789+00	2026-09-01 23:16:24.805+00
06a131bb-6c18-49f1-995e-7a063a75984f	900000012	MELISA	DE LOS SANTOS	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.817+00	2026-09-01 23:16:24.833+00
9e572ad5-ab00-431a-8a26-2c4f164bc395	900000013	AZUL	DE MICHIELIS	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.845+00	2026-09-01 23:16:24.86+00
bbaf8c54-9e44-4aa6-bc23-a114e76f3ef1	900000014	AITANA NICOL	DEL VALLE	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.872+00	2026-09-01 23:16:24.888+00
02d9023c-0a67-44a3-bcc7-2b4b3a754f65	900000015	CAMILA	DELLAGNOLO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.9+00	2026-09-01 23:16:24.916+00
52c35e31-14c2-4f84-85d4-f89e9107be74	900000016	AYELEN	DIAZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.929+00	2026-09-01 23:16:24.945+00
92bb2d92-132e-4a5b-a36d-2bbab6e6ab11	900000017	NAHUEL	DOMINGUEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.957+00	2026-09-01 23:16:24.973+00
6ca401a1-db2a-43c5-ac31-52923f8bdd27	900000018	GUILIANA	DUARTE	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:24.985+00	2026-09-01 23:16:25.001+00
21b2257c-7492-463f-bed4-0b5ca7ca113b	900000019	JOAQUINA	ELLI	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.013+00	2026-09-01 23:16:25.029+00
9bfed794-3f6d-4818-9eb6-db2137c537aa	900000020	PATRICIO	ENCISO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.041+00	2026-09-01 23:16:25.057+00
9824cac2-38f9-4a24-a519-1a0a83d41c65	900000021	LETICIA AILEN	FERNANDEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.07+00	2026-09-01 23:16:25.085+00
318d8778-eeff-40e8-811d-8000e75edc20	900000022	TERESA	FLEITAS	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.097+00	2026-09-01 23:16:25.114+00
c01cd7ac-53dc-4bbc-a264-156ba2c47740	900000023	ANAPAULA	GALEANO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.125+00	2026-09-01 23:16:25.141+00
cc2dd8cf-6d27-4160-9f21-e7ab6e70caaa	900000024	SILVIA	GALEANO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.153+00	2026-09-01 23:16:25.17+00
448e87a5-d05c-42b0-ad59-8a81257fcb16	900000025	FRANCESCA	GAUTO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.182+00	2026-09-01 23:16:25.198+00
a4311dc4-9586-4748-ba75-e8267325ce92	900000026	GERARDO	OBREGON	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.209+00	2026-09-01 23:16:25.226+00
d883266d-b3d1-4298-a82f-c9c1c3fba8f9	900000027	GABRIELA	GIMENEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.238+00	2026-09-01 23:16:25.257+00
a6547d41-ef22-43f1-b207-1031963df8c7	900000028	KIARA	GIMENEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.269+00	2026-09-01 23:16:25.285+00
195b6bb2-2205-4c1d-8d17-facdd38bd1ad	900000029	GISSELLA	MIQUEL	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.297+00	2026-09-01 23:16:25.313+00
79412d0d-8657-40b6-b6db-04177f5f980e	900000030	PATRICIA	GLERIA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.324+00	2026-09-01 23:16:25.34+00
5f841506-570f-4095-a9be-71b922850761	900000031	FEDERICO ADRIAN	GOMEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.353+00	2026-09-01 23:16:25.369+00
f61d7eb7-a42e-4bc0-836b-a1655d83c94b	900000032	MONICA	GONZALEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.381+00	2026-09-01 23:16:25.398+00
2040948d-aa7e-41c5-bf6e-e44e5b811edf	900000033	VANESA	INSAURRALDE	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.409+00	2026-09-01 23:16:25.428+00
abb999ff-0a0c-4c89-9f11-866dcfc9b8a3	900000034	YASLIN	ISASI	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.442+00	2026-09-01 23:16:25.46+00
e8b8ce41-b5d7-4cb5-8978-a66c2a7802a1	900000035	EUGENIA ROSELY	LAGRAÑA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.473+00	2026-09-01 23:16:25.495+00
1bfc8cac-53c2-4be7-b3e3-970d0986300c	900000036	ARIANA	LEPEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.511+00	2026-09-01 23:16:25.532+00
7346ffaa-43e5-40a9-bbcc-c16b13d68b9a	900000037	OMAR	LEYES	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.548+00	2026-09-01 23:16:25.57+00
b332d210-8a32-4dbe-9cb0-26531812b718	900000038	MARTINA	LO CURCIO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.585+00	2026-09-01 23:16:25.606+00
48ff1294-dfb7-4f47-b3b4-21d4958507b6	900000039	ANDREA ISABEL	LUQUE	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.618+00	2026-09-01 23:16:25.634+00
138402df-f8c6-41f2-8dfb-93b4f2d58ae2	900000040	STEFANIA	MARTINEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.645+00	2026-09-01 23:16:25.662+00
07a722ab-125e-42a3-a6a7-3a2e30263da1	900000041	GIULIANA	MATTEO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.674+00	2026-09-01 23:16:25.69+00
2d86741a-8804-4685-ae76-14c09f10ae69	900000042	ERIK	MEDINA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.702+00	2026-09-01 23:16:25.718+00
164ebd7e-5b8c-4bdd-93e8-9966ca2aab60	900000043	YANI	MEDINA PATIÑO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.73+00	2026-09-01 23:16:25.745+00
6922fe2b-0e8a-44e6-96a8-ce2567990577	900000044	KAREN	MONTIEL	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.759+00	2026-09-01 23:16:25.775+00
55cceffa-4357-40ab-b794-90af655ef2e8	900000045	LAURA	MONYO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.786+00	2026-09-01 23:16:25.802+00
cf8dcccd-6443-4614-9282-ee4e5b03ed26	900000046	ALEJANDRA	MORCILLO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.813+00	2026-09-01 23:16:25.828+00
d32595b3-343e-4cff-a758-5e2c0ddc7875	900000047	JORGE	OJEDA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.839+00	2026-09-01 23:16:25.856+00
8995d37f-b5f1-48ce-99ed-57968c270f13	900000048	ELIDA	ORRABALIS	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.867+00	2026-09-01 23:16:25.883+00
fa7f3230-6659-47f3-a3a7-c19dd7d30422	900000049	NAHIARA	PENAYO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.895+00	2026-09-01 23:16:25.911+00
d276a4b8-4e1b-4fbb-bc73-0a819f55d87a	900000050	PRISCILA	PERALTA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.922+00	2026-09-01 23:16:25.938+00
f2601c98-4da9-46c2-9dbd-6ff77a00b2b2	900000051	LAURA	QUINTANA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.95+00	2026-09-01 23:16:25.965+00
a1a9745f-8498-4d56-a165-acae4b879669	900000052	CELESTE	RAMIREZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:25.976+00	2026-09-01 23:16:25.993+00
55bd8062-567f-46a1-bcf4-d320724a2751	900000053	TATIANA	RAMOA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.004+00	2026-09-01 23:16:26.02+00
bfe429e3-0f97-4c01-9ec2-6801034cc59a	900000054	MAIA	REYES	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.032+00	2026-09-01 23:16:26.048+00
6b2ec08b-9b2f-437a-a8d3-1542eb1e5431	900000055	MAXI	REYES	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.059+00	2026-09-01 23:16:26.075+00
0c5a89d6-3fa9-4d01-8d22-7f211c529233	900000056	ANDREA	RIGONATO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.088+00	2026-09-01 23:16:26.104+00
32868316-0a76-48ca-92df-907819f95ee0	900000057	MARIANA	RIOS	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.116+00	2026-09-01 23:16:26.133+00
eb5a6d21-cab0-4691-ba3f-8df0bcc3a840	900000058	KARLA AGOSTINA	RIVAS	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.144+00	2026-09-01 23:16:26.16+00
56ddde98-b97a-4c5b-9a58-866ea64a1095	900000059	ROMINA	RIVERO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.172+00	2026-09-01 23:16:26.187+00
f049e028-1cf8-4ccb-832d-7d4fdc3b9f8e	900000060	RENATTA	ROLDAN	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.199+00	2026-09-01 23:16:26.214+00
86c22eb2-f07a-4002-8c76-d5d688c4f4b8	900000061	FLORENCIA	RUIZ DIAZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.226+00	2026-09-01 23:16:26.241+00
3d6a1882-aaa5-4411-965d-eea4e8bb045c	900000062	ILEANA	SILVERA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.255+00	2026-09-01 23:16:26.271+00
bd45daf1-865c-4187-9c5c-41323f7ecf8a	900000063	PAOLA	SORAIRE	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.284+00	2026-09-01 23:16:26.3+00
40aa21c7-6da6-47c5-8b98-071589040438	900000064	LORENA	SOSA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.312+00	2026-09-01 23:16:26.329+00
61c2d14a-0a44-48f9-ba66-f1fff2f268fd	900000065	NATALIA	VELAZQUEZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.343+00	2026-09-01 23:16:26.361+00
e693f3c0-ccdc-485b-b4b9-bc58aae6badd	900000066	ANALIA	VIERA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.373+00	2026-09-01 23:16:26.389+00
42c47e3a-2aa2-48f4-a224-d7acab609aa8	900000067	VALERIA	VILLA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.4+00	2026-09-01 23:16:26.417+00
997f0b86-ece1-4b58-a25f-894a80521309	900000068	LUCIANA	VILLAGRA	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.429+00	2026-09-01 23:16:26.445+00
3c3c5aca-529e-47b4-ba86-a75edc058f5a	900000069	LORENA	VILLAMAYOR	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.456+00	2026-09-01 23:16:26.473+00
ab94828d-c73a-46a2-84e9-e708b0f27c96	900000070	YANINA	ORTIZ	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.484+00	2026-09-01 23:16:26.501+00
621c263e-af9f-4315-8870-1c374afb5534	900000071	ALEJANDRO	ZARACHO	\N	\N	\N	\N	2026-09-01	INACTIVE	2026-09-01 23:16:26.512+00	2026-09-01 23:16:26.528+00
\.


--
-- Data for Name: tariffs; Type: TABLE DATA; Schema: public; Owner: academy
--

COPY public.tariffs (id, name, amount, valid_from, valid_to, status, created_at, updated_at) FROM stdin;
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
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


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
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: academy
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


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
-- Name: branches_name_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX branches_name_idx ON public.branches USING btree (name);


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
-- Name: payments_payment_method_paid_at_idx; Type: INDEX; Schema: public; Owner: academy
--

CREATE INDEX payments_payment_method_paid_at_idx ON public.payments USING btree (payment_method, paid_at);


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
-- PostgreSQL database dump complete
--

\unrestrict PBM6vMZFEdyFGbuCcA8g2lJruWbaSV7HD2aOdSFYioxv1qhEjyArEhP3FkhKly2

